import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import { BusinessCenter as BusinessIcon } from '@mui/icons-material';

const businessSetupSchema = z.object({
  name: z.string().min(3, 'Business name must be at least 3 characters'),
  gstin: z.string().refine((val) => {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val.toUpperCase());
  }, {
    message: 'Enter a valid 15-character GSTIN format (e.g. 27AAAAA1111A1Z1)',
  }),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  phone: z.string().min(10, 'Enter a valid phone number').max(15).optional().or(z.literal('')),
  email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
  logoUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
});

type OnboardingFields = z.infer<typeof businessSetupSchema>;

const Onboarding: React.FC = () => {
  const { setupBusiness } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFields>({
    resolver: zodResolver(businessSetupSchema),
  });

  const onSubmit = async (data: OnboardingFields) => {
    setError(null);
    try {
      const payload = {
        name: data.name,
        gstin: data.gstin.toUpperCase(),
        address: data.address,
        phone: data.phone || undefined,
        email: data.email || undefined,
        logoUrl: data.logoUrl || undefined,
      };
      
      const res = await setupBusiness(payload);
      if (res.success) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Onboarding failed. Please try again.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'radial-gradient(circle at 10% 20%, rgba(244, 252, 246, 1) 0%, rgba(226, 236, 253, 1) 90%)',
        py: 4,
      }}
    >
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 800,
              color: 'primary.main',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <BusinessIcon sx={{ color: 'secondary.main', fontSize: 32 }} /> Setup Your Business
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Provide your business information to generate GST-compliant tax invoices
          </Typography>
        </Box>

        <Card sx={{ border: '1px solid rgba(226, 232, 240, 0.8)' }}>
          <CardContent sx={{ p: 4 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Business Legal Name"
                    placeholder="Supertronics Electricals"
                    {...register('name')}
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="GSTIN"
                    placeholder="27AAAAA1111A1Z1"
                    {...register('gstin')}
                    error={!!errors.gstin}
                    helperText={errors.gstin?.message}
                    slotProps={{
                      htmlInput: {
                        style: { textTransform: 'uppercase' }
                      }
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Business Email"
                    placeholder="info@supertronics.com"
                    {...register('email')}
                    error={!!errors.email}
                    helperText={errors.email?.message}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Business Phone"
                    placeholder="9876543210"
                    {...register('phone')}
                    error={!!errors.phone}
                    helperText={errors.phone?.message}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Business Logo URL (Optional)"
                    placeholder="https://example.com/logo.png"
                    {...register('logoUrl')}
                    error={!!errors.logoUrl}
                    helperText={errors.logoUrl?.message}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Registered Address"
                    placeholder="102, Industrial Area Phase II, Mumbai, Maharashtra, 400011"
                    {...register('address')}
                    error={!!errors.address}
                    helperText={errors.address?.message}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    color="secondary"
                    size="large"
                    disabled={isSubmitting}
                    sx={{ py: 1.5, fontSize: '16px' }}
                  >
                    {isSubmitting ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      'Complete Setup & Launch'
                    )}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Onboarding;
