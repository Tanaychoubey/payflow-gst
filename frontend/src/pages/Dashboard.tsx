import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
} from '@mui/material';
import {
  TrendingUp as RevenueIcon,
  HourglassEmpty as OutstandingIcon,
  WarningAmber as OverdueIcon,
  History as ActivityIcon,
  AccountCircle as AccountIcon,
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboardReport'],
    queryFn: async () => {
      const res = await api.get('/reports/dashboard');
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, height: '80vh' }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  if (error || !dashboardData) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error loading dashboard report details. Please try again.</Typography>
      </Box>
    );
  }

  const { metrics, aging, topDebtors, recentActivity } = dashboardData;

  const chartData = [
    { name: '0-30 Days', amount: aging['0-30'] },
    { name: '31-60 Days', amount: aging['31-60'] },
    { name: '61-90 Days', amount: aging['61-90'] },
    { name: '90+ Days', amount: aging['90+'] },
  ];

  const cards = [
    {
      title: 'Total Revenue',
      value: `₹${Number(metrics.totalRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <RevenueIcon sx={{ color: '#10b981', fontSize: 32 }} />,
      desc: 'All non-draft sales generated',
      bgcolor: 'rgba(16, 185, 129, 0.08)',
    },
    {
      title: 'Total Outstanding',
      value: `₹${Number(metrics.totalOutstanding).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <OutstandingIcon sx={{ color: '#3b82f6', fontSize: 32 }} />,
      desc: 'Awaiting customer collections',
      bgcolor: 'rgba(59, 130, 246, 0.08)',
    },
    {
      title: 'Overdue Amount',
      value: `₹${Number(metrics.totalOverdue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <OverdueIcon sx={{ color: '#ef4444', fontSize: 32 }} />,
      desc: `${metrics.overdueCount} invoices past due dates`,
      bgcolor: 'rgba(239, 68, 68, 0.08)',
    },
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', mb: 1, fontWeight: 800 }}>
          Dashboard Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Real-time insights on your business outstanding receivables, billing, and tax metrics.
        </Typography>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {cards.map((card) => (
          <Grid size={{ xs: 12, md: 4 }} key={card.title}>
            <Card sx={{ border: '1px solid #f1f5f9' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 3 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    backgroundColor: card.bgcolor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.icon}
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5, fontFamily: '"Outfit", sans-serif', fontWeight: 800 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {card.desc}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Receivables Aging Chart */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: '100%', border: '1px solid #f1f5f9', p: 3 }}>
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', mb: 3, fontWeight: 700 }}>
              Receivables Aging Analysis
            </Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                  <Tooltip
                    formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="amount" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Top Debtors & Aging */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: '100%', border: '1px solid #f1f5f9', p: 3 }}>
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', mb: 3, fontWeight: 700 }}>
              Top Debtors
            </Typography>
            {topDebtors.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', py: 4 }}>
                <Typography color="text.secondary">No outstanding debt collections required!</Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {topDebtors.map((debtor: any, index: number) => (
                  <React.Fragment key={debtor.id}>
                    <ListItem sx={{ px: 0, py: 1.5 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', color: 'info.main' }}>
                          <AccountIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                            {debtor.name}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ fontSize: '12px', color: 'text.secondary', display: 'block' }}>
                            Active customer account
                          </Typography>
                        }
                      />
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          ₹{Number(debtor.outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                    </ListItem>
                    {index < topDebtors.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Card>
        </Grid>

        {/* Recent Activity Feed */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ border: '1px solid #f1f5f9', p: 3 }}>
            <Typography
              variant="h6"
              sx={{ fontFamily: '"Outfit", sans-serif', mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}
            >
              <ActivityIcon sx={{ color: 'secondary.main' }} /> Recent Activity Log
            </Typography>
            {recentActivity.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>No recent system activities logged.</Typography>
            ) : (
              <Grid container spacing={2}>
                {recentActivity.map((log: any) => {
                  let logMessage = '';
                  if (log.action === 'CREATE') {
                    logMessage = `Created invoice ${log.metadata?.invoiceNumber} totaling ₹${Number(log.metadata?.totalAmount).toLocaleString('en-IN')}`;
                  } else if (log.action === 'RECORD_PAYMENT') {
                    logMessage = `Recorded payment of ₹${Number(log.metadata?.amount).toLocaleString('en-IN')} for invoice ${log.metadata?.invoiceNumber}. Status: ${log.metadata?.newStatus}`;
                  }

                  return (
                    <Grid size={{ xs: 12, md: 6 }} key={log.id}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {logMessage}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            By {log.user.name} ({log.user.email})
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
