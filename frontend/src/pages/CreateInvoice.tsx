import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';

interface InvoiceLineItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

const CreateInvoice: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [items, setItems] = useState<InvoiceLineItem[]>([
    { productName: '', quantity: 1, unitPrice: 0, gstRate: 18 },
  ]);

  // Fetch customers
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data.data.customers;
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/invoices', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardReport'] });
      navigate('/invoices');
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to create invoice');
    },
  });

  const handleAddItem = () => {
    setItems([...items, { productName: '', quantity: 1, unitPrice: 0, gstRate: 18 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const newItems = [...items];
    if (field === 'productName') {
      newItems[index].productName = value;
    } else {
      newItems[index][field] = Number(value) || 0;
    }
    setItems(newItems);
  };

  // Live Math calculations
  let subtotal = 0;
  let gstAmount = 0;
  items.forEach((item) => {
    const itemSub = item.quantity * item.unitPrice;
    const itemGst = itemSub * (item.gstRate / 100);
    subtotal += itemSub;
    gstAmount += itemGst;
  });

  const grandTotal = subtotal + gstAmount - discountAmount;

  const handleSubmit = (status: 'draft' | 'unpaid') => {
    setFormError(null);

    // Validation
    if (!customerId) {
      setFormError('Please select a customer.');
      return;
    }

    const invalidItem = items.find(
      (item) => !item.productName.trim() || item.quantity <= 0 || item.unitPrice <= 0
    );

    if (invalidItem) {
      setFormError('All items must have a description, positive quantity, and positive price.');
      return;
    }

    const payload = {
      customerId,
      invoiceDate,
      dueDate,
      discountAmount,
      status,
      items,
    };

    createInvoiceMutation.mutate(payload);
  };

  if (customersLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', mb: 1, fontWeight: 800 }}>
          Create GST Invoice
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Generate an itemized tax invoice. All values, taxes, and totals calculate dynamically.
        </Typography>
      </Box>

      {formError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {formError}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Basic settings */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel id="customer-select-label">Select Customer</InputLabel>
                    <Select
                      labelId="customer-select-label"
                      value={customerId}
                      label="Select Customer"
                      onChange={(e) => setCustomerId(e.target.value)}
                    >
                      {customers?.map((c: any) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name} {c.gstin ? `(${c.gstin})` : '(Unregistered)'}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Invoice Date"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Due Date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Itemized Lines */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', mb: 3, fontWeight: 700 }}>
                Line Items
              </Typography>

              <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell width="40%">Item Details</TableCell>
                      <TableCell width="12%">Qty</TableCell>
                      <TableCell width="18%">Unit Price (₹)</TableCell>
                      <TableCell width="15%">GST Rate</TableCell>
                      <TableCell width="15%">Total (₹)</TableCell>
                      <TableCell width="5%" align="center"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, index) => {
                      const lineTotal = item.quantity * item.unitPrice * (1 + item.gstRate / 100);
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <TextField
                              fullWidth
                              placeholder="e.g. Copper Wire Coil 100m"
                              value={item.productName}
                              onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              type="number"
                              value={item.unitPrice === 0 ? '' : item.unitPrice}
                              placeholder="0.00"
                              onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <FormControl fullWidth>
                              <Select
                                value={item.gstRate}
                                onChange={(e) => handleItemChange(index, 'gstRate', e.target.value)}
                              >
                                <MenuItem value={0}>0%</MenuItem>
                                <MenuItem value={5}>5%</MenuItem>
                                <MenuItem value={12}>12%</MenuItem>
                                <MenuItem value={18}>18%</MenuItem>
                                <MenuItem value={28}>28%</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              color="error"
                              onClick={() => handleRemoveItem(index)}
                              disabled={items.length === 1}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <Button
                variant="outlined"
                color="secondary"
                startIcon={<AddIcon />}
                onClick={handleAddItem}
                sx={{ mt: 3 }}
              >
                Add Line Item
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Live summary and Submit */}
        <Grid size={{ xs: 12 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 7 }}></Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ border: '1px solid #f1f5f9', p: 3 }}>
                <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', mb: 2, fontWeight: 700 }}>
                  Summary Totals
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Gross Subtotal</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">GST Tax Value</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Discount (₹)</Typography>
                    <TextField
                      type="number"
                      size="small"
                      value={discountAmount === 0 ? '' : discountAmount}
                      placeholder="0.00"
                      onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                      sx={{ width: 120 }}
                    />
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '17px' }}>Grand Total</Typography>
                    <Typography color="secondary.main" sx={{ fontWeight: 800, fontSize: '18px' }}>
                      ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="inherit"
                    onClick={() => handleSubmit('draft')}
                    disabled={createInvoiceMutation.isPending}
                  >
                    Save Draft
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    startIcon={<ReceiptIcon />}
                    onClick={() => handleSubmit('unpaid')}
                    disabled={createInvoiceMutation.isPending}
                  >
                    {createInvoiceMutation.isPending ? <CircularProgress size={24} /> : 'Finalize & Send'}
                  </Button>
                </Box>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CreateInvoice;
