import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Box,
  Typography,
  Card,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  GetApp as DownloadIcon,
  Visibility as ViewIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  
  // Filters State
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch Invoices
  const { data: invoicesData, isLoading, error } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      const res = await api.get(`/invoices?status=${statusFilter}`);
      return res.data.data.invoices;
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await api.get(`/invoices/${invoiceId}/pdf`);
      return res.data.data;
    },
    onSuccess: (data) => {
      // Decode base64 to blob and trigger download
      const byteCharacters = atob(data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'text/html' });
      
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = data.fileName.replace('.pdf', '.html');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  });

  const handleViewDetails = (invoice: any) => {
    setSelectedInvoice(invoice);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedInvoice(null);
  };

  const getStatusChip = (status: string) => {
    const colors: { [key: string]: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success' } = {
      draft: 'default',
      unpaid: 'warning',
      partial: 'primary',
      paid: 'success',
      overdue: 'error',
    };
    return (
      <Chip
        label={status.toUpperCase()}
        color={colors[status] || 'default'}
        size="small"
        sx={{ fontWeight: 600, fontSize: '11px' }}
      />
    );
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', mb: 1, fontWeight: 800 }}>
            Invoices
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate tax invoices, review payments history, and track overdue receivables.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/invoices/create')}
        >
          Create GST Invoice
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to fetch invoices list. Please reload.
        </Alert>
      )}

      {/* Filter Toolbar */}
      <Card sx={{ border: '1px solid #f1f5f9', mb: 3 }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
          <FormControl sx={{ minWidth: 200 }} size="small">
            <InputLabel id="status-filter-label">Filter by Status</InputLabel>
            <Select
              labelId="status-filter-label"
              value={statusFilter}
              label="Filter by Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="unpaid">Unpaid</MenuItem>
              <MenuItem value="partial">Partial</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      {/* Invoices List Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid #f1f5f9', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Invoice Number</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Dates</TableCell>
              <TableCell>Grand Total</TableCell>
              <TableCell>Outstanding</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoicesData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No invoices created matching this status filter.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              invoicesData?.map((invoice: any) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {invoice.invoiceNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {invoice.customer.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {invoice.customer.gstin ? `GSTIN: ${invoice.customer.gstin}` : 'Unregistered Dealer'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.primary">
                      {new Date(invoice.invoiceDate).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Due: {new Date(invoice.dueDate).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      ₹{Number(invoice.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: invoice.outstandingAmount > 0 ? 'error.main' : 'success.main' }}>
                      ₹{Number(invoice.outstandingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(invoice.status)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleViewDetails(invoice)} title="View Details">
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="secondary"
                      onClick={() => downloadPdfMutation.mutate(invoice.id)}
                      disabled={downloadPdfMutation.isPending}
                      title="Download Invoice File"
                    >
                      <DownloadIcon />
                    </IconButton>
                    {invoice.status !== 'paid' && invoice.status !== 'draft' && (
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => navigate(`/payments?invoice=${invoice.id}`)}
                        title="Record Payment"
                      >
                        <PaymentIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Invoice Details Dialog */}
      <Dialog open={detailsOpen} onClose={handleCloseDetails} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
          Invoice Details — {selectedInvoice?.invoiceNumber}
        </DialogTitle>
        <DialogContent dividers>
          {selectedInvoice && (
            <Box>
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">Bill To:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{selectedInvoice.customer.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    GSTIN: {selectedInvoice.customer.gstin || 'Unregistered'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: { md: 'right' } }}>
                  <Typography variant="subtitle2" color="text.secondary">Invoice Status:</Typography>
                  <Box sx={{ mt: 0.5, mb: 1 }}>{getStatusChip(selectedInvoice.status)}</Box>
                  <Typography variant="body2" color="text.secondary">
                    Issued: {new Date(selectedInvoice.invoiceDate).toLocaleDateString()} | Due: {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                  </Typography>
                </Grid>
              </Grid>

              {/* Items Section */}
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>Itemized Breakdown:</Typography>
              <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 2, mb: 4 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Description</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Unit Price (₹)</TableCell>
                      <TableCell align="right">GST Rate</TableCell>
                      <TableCell align="right">Total Line (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <InvoiceDetailsFetcher invoiceId={selectedInvoice.id} />
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDetails} color="inherit">Close</Button>
          {selectedInvoice && selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'draft' && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<PaymentIcon />}
              onClick={() => { handleCloseDetails(); navigate(`/payments?invoice=${selectedInvoice.id}`); }}
            >
              Record Payment
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Internal Helper to Fetch and render detailed lines/payments for Single Invoice
const InvoiceDetailsFetcher: React.FC<{ invoiceId: string }> = ({ invoiceId }) => {
  const { data: details, isLoading } = useQuery({
    queryKey: ['invoice-details', invoiceId],
    queryFn: async () => {
      const res = await api.get(`/invoices/${invoiceId}`);
      return res.data.data.invoice;
    },
  });

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
          <CircularProgress size={24} color="secondary" />
        </TableCell>
      </TableRow>
    );
  }

  if (!details) {
    return (
      <TableRow>
        <TableCell colSpan={5} align="center" sx={{ py: 2 }}>
          <Typography color="error">Error loading details</Typography>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {details.items.map((item: any) => (
        <TableRow key={item.id}>
          <TableCell>{item.productName}</TableCell>
          <TableCell align="right">{Number(item.quantity)}</TableCell>
          <TableCell align="right">₹{Number(item.unitPrice).toFixed(2)}</TableCell>
          <TableCell align="right">{Number(item.gstRate)}%</TableCell>
          <TableCell align="right">₹{Number(item.lineTotal).toFixed(2)}</TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell colSpan={3} sx={{ border: 'none' }}></TableCell>
        <TableCell align="right" sx={{ fontWeight: 700 }}>Subtotal:</TableCell>
        <TableCell align="right" sx={{ fontWeight: 700 }}>₹{Number(details.subtotal).toFixed(2)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={3} sx={{ border: 'none' }}></TableCell>
        <TableCell align="right" sx={{ fontWeight: 700 }}>GST Tax:</TableCell>
        <TableCell align="right" sx={{ fontWeight: 700 }}>₹{Number(details.gstAmount).toFixed(2)}</TableCell>
      </TableRow>
      {Number(details.discountAmount) > 0 && (
        <TableRow>
          <TableCell colSpan={3} sx={{ border: 'none' }}></TableCell>
          <TableCell align="right" sx={{ fontWeight: 700 }}>Discount:</TableCell>
          <TableCell align="right" sx={{ fontWeight: 700 }}>-₹{Number(details.discountAmount).toFixed(2)}</TableCell>
        </TableRow>
      )}
      <TableRow>
        <TableCell colSpan={3} sx={{ border: 'none' }}></TableCell>
        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '15px' }}>Grand Total:</TableCell>
        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '15px' }}>₹{Number(details.totalAmount).toFixed(2)}</TableCell>
      </TableRow>
    </>
  );
};

export default Invoices;
