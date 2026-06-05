import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  Typography,
  Card,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  ContactMail as ContactIcon,
} from '@mui/icons-material';

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gstin: z.string().max(15, 'GSTIN cannot exceed 15 characters').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
});

type CustomerFields = z.infer<typeof customerSchema>;

const Customers: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: customerData, isLoading, error } = useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      const res = await api.get(`/customers?search=${search}`);
      return res.data.data.customers;
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFields) => {
      const res = await api.post('/customers', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      handleClose();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to create customer');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFields>({
    resolver: zodResolver(customerSchema),
  });

  const handleOpen = () => {
    setOpen(true);
    setFormError(null);
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const onSubmit = (data: CustomerFields) => {
    createCustomerMutation.mutate(data);
  };

  if (isLoading && !search) {
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
            Customers CRM
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your client directory, review outstanding ledgers, and contact information.
          </Typography>
        </Box>
        <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleOpen}>
          New Customer
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Error fetching customer records. Please reload the page.
        </Alert>
      )}

      {/* Search Input */}
      <Card sx={{ border: '1px solid #f1f5f9', mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            placeholder="Search by name, email, phone, or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }
            }}
          />
        </Box>
      </Card>

      {/* Customer Directory Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid #f1f5f9', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Customer Name</TableCell>
              <TableCell>Contact Details</TableCell>
              <TableCell>GSTIN</TableCell>
              <TableCell>Outstanding Balance</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customerData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No customer accounts match your search filters.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              customerData?.map((customer: any) => (
                <TableRow key={customer.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {customer.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {customer.address || 'No address added'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.primary' }}>
                      {customer.phone || '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {customer.email || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: customer.gstin ? 'text.primary' : 'text.secondary' }}>
                      {customer.gstin || 'Unregistered'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, color: customer.outstandingBalance > 0 ? 'error.main' : 'success.main' }}
                    >
                      ₹{Number(customer.outstandingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      href={`/reports?ledger=${customer.id}`}
                      sx={{ mr: 1 }}
                    >
                      View Ledger
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* New Customer Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
          Add New Customer
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent sx={{ pt: 1 }}>
            {formError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {formError}
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                fullWidth
                label="Customer Name"
                placeholder="Apex Electrical Distributors"
                {...register('name')}
                error={!!errors.name}
                helperText={errors.name?.message}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <BusinessIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }
                }}
              />

              <TextField
                fullWidth
                label="Email Address"
                placeholder="contact@apexelectricals.com"
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <ContactIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }
                }}
              />

              <TextField
                fullWidth
                label="Phone Number"
                placeholder="8765432100"
                {...register('phone')}
                error={!!errors.phone}
                helperText={errors.phone?.message}
              />

              <TextField
                fullWidth
                label="Customer GSTIN (Optional)"
                placeholder="27BBBBB2222B2Z2"
                {...register('gstin')}
                error={!!errors.gstin}
                helperText={errors.gstin?.message}
                slotProps={{
                  htmlInput: {
                    style: { textTransform: 'uppercase' }
                  }
                }}
              />

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Billing Address"
                placeholder="Vashi, Navi Mumbai, Maharashtra, 400703"
                {...register('address')}
                error={!!errors.address}
                helperText={errors.address?.message}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleClose} color="inherit">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="secondary"
              disabled={createCustomerMutation.isPending}
            >
              {createCustomerMutation.isPending ? <CircularProgress size={24} /> : 'Save Customer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Customers;
