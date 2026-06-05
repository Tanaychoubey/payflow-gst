import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';

const businessProfileSchema = z.object({
  name: z.string().min(3, 'Business name must be at least 3 characters'),
  address: z.string().min(5, 'Address is too short'),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  logoUrl: z.string().url('Invalid logo URL').optional().or(z.literal('')),
});

const staffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['owner', 'manager', 'staff']),
});

type BusinessFields = z.infer<typeof businessProfileSchema>;
type StaffFields = z.infer<typeof staffSchema>;

const Settings: React.FC = () => {
  const { user, refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [businessSuccess, setBusinessSuccess] = useState<boolean>(false);

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<boolean>(false);

  // Fetch Team members
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: async () => {
      const res = await api.get('/business/team');
      return res.data.data.team;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: BusinessFields) => {
      const res = await api.put('/business/profile', data);
      return res.data;
    },
    onSuccess: async () => {
      setBusinessSuccess(true);
      await refreshSession();
      setTimeout(() => setBusinessSuccess(false), 5000);
    },
    onError: (err: any) => {
      setBusinessError(err.response?.data?.message || 'Failed to update business profile');
    },
  });

  const addStaffMutation = useMutation({
    mutationFn: async (data: StaffFields) => {
      const res = await api.post('/business/team', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      setStaffSuccess(true);
      handleStaffClose();
      setTimeout(() => setStaffSuccess(false), 5000);
    },
    onError: (err: any) => {
      setStaffError(err.response?.data?.message || 'Failed to add team member');
    },
  });

  const {
    register: registerBusiness,
    handleSubmit: handleSubmitBusiness,
    formState: { errors: businessErrors },
  } = useForm<BusinessFields>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      name: user?.business?.name || '',
      address: user?.business?.address || '',
      phone: user?.business?.phone || '',
      email: user?.business?.email || '',
      logoUrl: user?.business?.logoUrl || '',
    },
  });

  const {
    register: registerStaff,
    handleSubmit: handleSubmitStaff,
    reset: resetStaff,
    formState: { errors: staffErrors },
  } = useForm<StaffFields>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      role: 'staff',
    },
  });

  const handleStaffOpen = () => {
    setStaffOpen(true);
    setStaffError(null);
  };

  const handleStaffClose = () => {
    setStaffOpen(false);
    resetStaff();
  };

  const onUpdateBusiness = (data: BusinessFields) => {
    setBusinessError(null);
    updateProfileMutation.mutate(data);
  };

  const onAddStaff = (data: StaffFields) => {
    setStaffError(null);
    addStaffMutation.mutate(data);
  };

  const isOwnerOrManager = user?.role === 'owner' || user?.role === 'manager';

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', mb: 1, fontWeight: 800 }}>
          Settings & Profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure your business profile identity, billing details, and manage team member access roles.
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Business Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ border: '1px solid #f1f5f9' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography
                variant="h6"
                sx={{ fontFamily: '"Outfit", sans-serif', mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}
              >
                <BusinessIcon sx={{ color: 'secondary.main' }} /> Business Profile
              </Typography>

              {businessError && <Alert severity="error" sx={{ mb: 2 }}>{businessError}</Alert>}
              {businessSuccess && <Alert severity="success" sx={{ mb: 2 }}>Business profile updated successfully!</Alert>}

              <form onSubmit={handleSubmitBusiness(onUpdateBusiness)}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <TextField
                    fullWidth
                    label="GSTIN (Read Only)"
                    value={user?.business?.gstin || ''}
                    disabled
                    helperText="GSTIN registration cannot be updated after onboarding setup."
                  />

                  <TextField
                    fullWidth
                    label="Business Legal Name"
                    placeholder="e.g. Supertronics Electricals"
                    disabled={!isOwnerOrManager}
                    {...registerBusiness('name')}
                    error={!!businessErrors.name}
                    helperText={businessErrors.name?.message}
                  />

                  <TextField
                    fullWidth
                    label="Contact Email"
                    placeholder="info@business.com"
                    disabled={!isOwnerOrManager}
                    {...registerBusiness('email')}
                    error={!!businessErrors.email}
                    helperText={businessErrors.email?.message}
                  />

                  <TextField
                    fullWidth
                    label="Contact Phone"
                    placeholder="9876543210"
                    disabled={!isOwnerOrManager}
                    {...registerBusiness('phone')}
                    error={!!businessErrors.phone}
                    helperText={businessErrors.phone?.message}
                  />

                  <TextField
                    fullWidth
                    label="Logo URL"
                    placeholder="https://example.com/logo.png"
                    disabled={!isOwnerOrManager}
                    {...registerBusiness('logoUrl')}
                    error={!!businessErrors.logoUrl}
                    helperText={businessErrors.logoUrl?.message}
                  />

                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Business Address"
                    placeholder="Registered business address..."
                    disabled={!isOwnerOrManager}
                    {...registerBusiness('address')}
                    error={!!businessErrors.address}
                    helperText={businessErrors.address?.message}
                  />

                  {isOwnerOrManager && (
                    <Button
                      type="submit"
                      variant="contained"
                      color="secondary"
                      sx={{ py: 1.2 }}
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? <CircularProgress size={24} /> : 'Save Profile Details'}
                    </Button>
                  )}
                </Box>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Team settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ border: '1px solid #f1f5f9', p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography
                variant="h6"
                sx={{ fontFamily: '"Outfit", sans-serif', display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}
              >
                <PeopleIcon sx={{ color: 'secondary.main' }} /> Team Accounts
              </Typography>
              {isOwnerOrManager && (
                <Button size="small" variant="outlined" color="secondary" onClick={handleStaffOpen}>
                  Add Member
                </Button>
              )}
            </Box>

            {staffSuccess && <Alert severity="success" sx={{ mb: 2 }}>New team member added successfully!</Alert>}

            {teamLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} color="secondary" /></Box>
            ) : (
              <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name / Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teamData?.map((member: any) => (
                      <TableRow key={member.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{member.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{member.email}</Typography>
                        </TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>
                          <Chip
                            label={member.role}
                            color={member.role === 'owner' ? 'secondary' : member.role === 'manager' ? 'primary' : 'default'}
                            size="small"
                            sx={{ fontWeight: 600, fontSize: '11px' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={member.isActive ? 'ACTIVE' : 'INACTIVE'}
                            color={member.isActive ? 'success' : 'default'}
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 600, fontSize: '10px' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Invite/Add Staff Modal */}
      <Dialog open={staffOpen} onClose={handleStaffClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700 }}>
          Add Team Member
        </DialogTitle>
        <form onSubmit={handleSubmitStaff(onAddStaff)}>
          <DialogContent sx={{ pt: 1 }}>
            {staffError && <Alert severity="error" sx={{ mb: 2 }}>{staffError}</Alert>}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                fullWidth
                label="Full Name"
                placeholder="Amit Patel"
                {...registerStaff('name')}
                error={!!staffErrors.name}
                helperText={staffErrors.name?.message}
              />

              <TextField
                fullWidth
                label="Email Address"
                placeholder="amit@business.com"
                {...registerStaff('email')}
                error={!!staffErrors.email}
                helperText={staffErrors.email?.message}
              />

              <TextField
                fullWidth
                label="Phone Number"
                placeholder="9876543213"
                {...registerStaff('phone')}
                error={!!staffErrors.phone}
                helperText={staffErrors.phone?.message}
              />

              <TextField
                fullWidth
                label="Temporary Password"
                type="password"
                placeholder="Min. 8 characters"
                {...registerStaff('password')}
                error={!!staffErrors.password}
                helperText={staffErrors.password?.message}
              />

              <FormControl fullWidth>
                <InputLabel id="role-select-label">Access Role</InputLabel>
                <Select
                  labelId="role-select-label"
                  label="Access Role"
                  {...registerStaff('role')}
                  error={!!staffErrors.role}
                >
                  <MenuItem value="staff">Staff (Billing only)</MenuItem>
                  <MenuItem value="manager">Manager (Billing & Payments)</MenuItem>
                  <MenuItem value="owner">Owner (Full Admin Access)</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleStaffClose} color="inherit">Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              color="secondary"
              disabled={addStaffMutation.isPending}
            >
              {addStaffMutation.isPending ? <CircularProgress size={24} /> : 'Create Account'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Settings;
