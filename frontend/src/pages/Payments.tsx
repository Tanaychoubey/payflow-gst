import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Payment as PaymentIcon } from '@mui/icons-material';

const Payments: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const queryInvoiceId = searchParams.get('invoice');

  // Recording State
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank' | 'cheque'>('upi');
  const [referenceNo, setReferenceNo] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Fetch Invoices to populate selection dropdown
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['unpaid-invoices-list'],
    queryFn: async () => {
      const res = await api.get('/invoices');
      // Return unpaid or partial invoices that need collections
      return res.data.data.invoices.filter((inv: any) => inv.status !== 'paid' && inv.status !== 'draft');
    },
  });

  // Fetch Payment History
  const { data: payments, isLoading: paymentsLoading, error } = useQuery({
    queryKey: ['payment-history'],
    queryFn: async () => {
      const res = await api.get('/payments');
      return res.data.data.payments;
    },
  });

  // Pre-select invoice if query parameter exists
  useEffect(() => {
    if (queryInvoiceId && invoices) {
      const exists = invoices.find((inv: any) => inv.id === queryInvoiceId);
      if (exists) {
        setInvoiceId(queryInvoiceId);
        setAmount(exists.outstandingAmount); // default to outstanding amount
      }
    }
  }, [queryInvoiceId, invoices]);

  // Adjust amount when invoice changes
  const handleInvoiceChange = (id: string) => {
    setInvoiceId(id);
    const selected = invoices?.find((inv: any) => inv.id === id);
    if (selected) {
      setAmount(selected.outstandingAmount);
      setFormError(null);
    }
  };

  const recordPaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/payments', payload);
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['unpaid-invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardReport'] });
      
      setFormSuccess(`Recorded payment of ₹${Number(res.data.payment.amount).toFixed(2)} successfully!`);
      // Reset form
      setInvoiceId('');
      setAmount('');
      setReferenceNo('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setTimeout(() => setFormSuccess(null), 5000);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to record payment');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!invoiceId) {
      setFormError('Please select an invoice.');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setFormError('Payment amount must be greater than 0.');
      return;
    }

    const payload = {
      invoiceId,
      amount: Number(amount),
      paymentMethod,
      referenceNo: referenceNo.trim() || undefined,
      paymentDate,
    };

    recordPaymentMutation.mutate(payload);
  };

  const loading = invoicesLoading || paymentsLoading;

  if (loading) {
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
          Payments Tracker
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Record customer collections, track invoice payments history, and update outstanding balances.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load payments details. Please refresh the page.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Record payment form */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography
                variant="h6"
                sx={{ fontFamily: '"Outfit", sans-serif', mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}
              >
                <PaymentIcon sx={{ color: 'secondary.main' }} /> Record Collection
              </Typography>

              {formError && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{formError}</Alert>}
              {formSuccess && <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }}>{formSuccess}</Alert>}

              <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <FormControl fullWidth>
                    <InputLabel id="payment-invoice-label">Select Invoice</InputLabel>
                    <Select
                      labelId="payment-invoice-label"
                      value={invoiceId}
                      label="Select Invoice"
                      onChange={(e) => handleInvoiceChange(e.target.value)}
                    >
                      {invoices?.length === 0 ? (
                        <MenuItem disabled>No outstanding invoices</MenuItem>
                      ) : (
                        invoices?.map((inv: any) => (
                          <MenuItem key={inv.id} value={inv.id}>
                            {inv.invoiceNumber} — {inv.customer.name} (Outstanding: ₹{Number(inv.outstandingAmount).toFixed(2)})
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label="Payment Amount (₹)"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                  />

                  <FormControl fullWidth>
                    <InputLabel id="method-select-label">Payment Method</InputLabel>
                    <Select
                      labelId="method-select-label"
                      value={paymentMethod}
                      label="Payment Method"
                      onChange={(e: any) => setPaymentMethod(e.target.value)}
                    >
                      <MenuItem value="upi">UPI (GPay/PhonePe/BHIM)</MenuItem>
                      <MenuItem value="bank">Bank Transfer (IMPS/NEFT/RTGS)</MenuItem>
                      <MenuItem value="cash">Cash Collection</MenuItem>
                      <MenuItem value="cheque">Cheque</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label="Reference Number / Txn ID"
                    placeholder="e.g. UPI8271829182"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                  />

                  <TextField
                    fullWidth
                    label="Payment Date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    color="secondary"
                    fullWidth
                    disabled={recordPaymentMutation.isPending}
                    sx={{ py: 1.2 }}
                  >
                    {recordPaymentMutation.isPending ? <CircularProgress size={24} /> : 'Save Collection'}
                  </Button>
                </Box>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Payment History list */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ border: '1px solid #f1f5f9', p: 3 }}>
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', mb: 3, fontWeight: 700 }}>
              Collection History
            </Typography>

            <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Invoice Details</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Reference No</TableCell>
                    <TableCell align="right">Amount Collected</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">No payment transactions recorded yet.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments?.map((payment: any) => (
                      <TableRow key={payment.id} hover>
                        <TableCell>
                          {new Date(payment.paymentDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {payment.invoice.invoiceNumber}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {payment.invoice.customer.name}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ textTransform: 'uppercase' }}>
                          {payment.paymentMethod}
                        </TableCell>
                        <TableCell color="text.secondary">
                          {payment.referenceNo || '—'}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                            ₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Payments;
