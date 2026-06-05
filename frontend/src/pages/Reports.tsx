import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
} from '@mui/material';
import { FileDownload as ExportIcon } from '@mui/icons-material';

const Reports: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryCustomerId = searchParams.get('ledger');

  const [activeTab, setActiveTab] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Fetch Customers for ledger selector
  const { data: customers } = useQuery({
    queryKey: ['reports-customers-list'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data.data.customers;
    },
  });

  // Pre-select ledger if query parameter exists
  useEffect(() => {
    if (queryCustomerId) {
      setSelectedCustomerId(queryCustomerId);
      setActiveTab(1); // switch to Ledger tab
    }
  }, [queryCustomerId]);

  // Fetch GST report
  const { data: gstReport, isLoading: gstLoading } = useQuery({
    queryKey: ['gstReport'],
    queryFn: async () => {
      const res = await api.get('/reports/gst');
      return res.data.data;
    },
    enabled: activeTab === 0,
  });

  // Fetch Customer Ledger
  const { data: ledgerReport, isLoading: ledgerLoading } = useQuery({
    queryKey: ['customerLedger', selectedCustomerId],
    queryFn: async () => {
      const res = await api.get(`/reports/ledger/${selectedCustomerId}`);
      return res.data.data;
    },
    enabled: activeTab === 1 && !!selectedCustomerId,
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleExportCSV = () => {
    // Generate simple mock CSV export and download
    let csvContent = "data:text/csv;charset=utf-8,";
    let fileName = "report.csv";

    if (activeTab === 0 && gstReport) {
      csvContent += "GST Rate,Taxable Amount (INR),GST Collected (INR),Total Sales (INR)\n";
      Object.entries(gstReport.gstBreakdown).forEach(([rate, data]: any) => {
        csvContent += `${rate},${data.taxableAmount.toFixed(2)},${data.gstCollected.toFixed(2)},${(data.taxableAmount + data.gstCollected).toFixed(2)}\n`;
      });
      fileName = "GST_Summary_Report.csv";
    } else if (activeTab === 1 && ledgerReport) {
      csvContent += `Customer Statement Ledger: ${ledgerReport.customer.name}\n\n`;
      csvContent += "Date,Transaction Type,Reference,Debit (Invoiced INR),Credit (Paid INR),Running Balance (INR)\n";
      ledgerReport.ledger.forEach((tx: any) => {
        csvContent += `${new Date(tx.date).toLocaleDateString()},${tx.type},${tx.reference},${tx.debit.toFixed(2)},${tx.credit.toFixed(2)},${tx.runningBalance.toFixed(2)}\n`;
      });
      fileName = `${ledgerReport.customer.name.replace(/\s+/g, '_')}_Ledger.csv`;
    } else {
      return;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', mb: 1, fontWeight: 800 }}>
            Reports & Statement Ledgers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate tax summaries, review customer ledgers, and download reports for your CA.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<ExportIcon />}
          onClick={handleExportCSV}
          disabled={(activeTab === 0 && !gstReport) || (activeTab === 1 && !ledgerReport)}
        >
          Export CSV Report
        </Button>
      </Box>

      {/* Tabs Menu */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} textColor="secondary" indicatorColor="secondary">
          <Tab label="GST Tax Summary" sx={{ fontWeight: 600 }} />
          <Tab label="Customer Ledgers" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Box>

      {/* Tab 1: GST Report */}
      {activeTab === 0 && (
        <Box>
          {gstLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress color="secondary" /></Box>
          ) : !gstReport ? (
            <Alert severity="warning">No GST transaction sales logged.</Alert>
          ) : (
            <Grid container spacing={3}>
              {/* Summary Cards */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ border: '1px solid #f1f5f9', p: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>Total Taxable Sales</Typography>
                    <Typography variant="h5" sx={{ fontFamily: '"Outfit", sans-serif', mt: 0.5, fontWeight: 800 }}>
                      ₹{Number(gstReport.totals.totalTaxableSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ border: '1px solid #f1f5f9', p: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>Total GST Tax Collected</Typography>
                    <Typography variant="h5" color="secondary.main" sx={{ fontFamily: '"Outfit", sans-serif', mt: 0.5, fontWeight: 800 }}>
                      ₹{Number(gstReport.totals.totalGstCollected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ border: '1px solid #f1f5f9', p: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>Total Gross Sales</Typography>
                    <Typography variant="h5" sx={{ fontFamily: '"Outfit", sans-serif', mt: 0.5, fontWeight: 800 }}>
                      ₹{Number(gstReport.totals.totalGrossSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* GST Breakdown Table */}
              <Grid size={{ xs: 12 }}>
                <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid #f1f5f9', boxShadow: 'none' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>GST Rate Class</TableCell>
                        <TableCell align="right">Item Sales Count</TableCell>
                        <TableCell align="right">Taxable Sales (₹)</TableCell>
                        <TableCell align="right">GST Tax Collected (₹)</TableCell>
                        <TableCell align="right">Gross Total (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.keys(gstReport.gstBreakdown).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">No tax records found.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        Object.entries(gstReport.gstBreakdown).map(([rate, data]: any) => (
                          <TableRow key={rate} hover>
                            <TableCell sx={{ fontWeight: 700 }}>{rate}</TableCell>
                            <TableCell align="right">{data.itemsCount}</TableCell>
                            <TableCell align="right">₹{Number(data.taxableAmount).toFixed(2)}</TableCell>
                            <TableCell align="right">₹{Number(data.gstCollected).toFixed(2)}</TableCell>
                            <TableCell align="right">₹{(Number(data.taxableAmount) + Number(data.gstCollected)).toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {/* Tab 2: Ledger Report */}
      {activeTab === 1 && (
        <Box>
          <Card sx={{ border: '1px solid #f1f5f9', mb: 3 }}>
            <CardContent sx={{ p: 3, display: 'flex', gap: 3, alignItems: 'center' }}>
              <FormControl sx={{ minWidth: 300 }}>
                <InputLabel id="ledger-customer-label">Select Customer Profile</InputLabel>
                <Select
                  labelId="ledger-customer-label"
                  value={selectedCustomerId}
                  label="Select Customer Profile"
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  {customers?.map((c: any) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {!selectedCustomerId && (
                <Typography variant="body2" color="text.secondary">
                  Please select a customer to view their chronological transaction ledger.
                </Typography>
              )}
            </CardContent>
          </Card>

          {selectedCustomerId && ledgerLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress color="secondary" /></Box>
          )}

          {selectedCustomerId && !ledgerLoading && ledgerReport && (
            <Grid container spacing={3}>
              {/* Ledger Summary Cards */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ border: '1px solid #f1f5f9', p: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>Total Billed amount</Typography>
                    <Typography variant="h5" sx={{ fontFamily: '"Outfit", sans-serif', mt: 0.5, fontWeight: 800 }}>
                      ₹{Number(ledgerReport.totalInvoiced).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ border: '1px solid #f1f5f9', p: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>Total Collected amount</Typography>
                    <Typography variant="h5" color="success.main" sx={{ fontFamily: '"Outfit", sans-serif', mt: 0.5, fontWeight: 800 }}>
                      ₹{Number(ledgerReport.totalPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ border: '1px solid #f1f5f9', p: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>Outstanding Balance Due</Typography>
                    <Typography variant="h5" color={ledgerReport.outstandingBalance > 0 ? 'error.main' : 'success.main'} sx={{ fontFamily: '"Outfit", sans-serif', mt: 0.5, fontWeight: 800 }}>
                      ₹{Number(ledgerReport.outstandingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Transaction Ledger list */}
              <Grid size={{ xs: 12 }}>
                <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid #f1f5f9', boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell align="right">Debit (Invoiced ₹)</TableCell>
                        <TableCell align="right">Credit (Collected ₹)</TableCell>
                        <TableCell align="right">Running Balance (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ledgerReport.ledger.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">No finalized transactions recorded for this client.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        ledgerReport.ledger.map((tx: any, idx: number) => (
                          <TableRow key={idx} hover>
                            <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: tx.type === 'INVOICE' ? 'primary.main' : 'success.main' }}>
                              {tx.type}
                            </TableCell>
                            <TableCell>{tx.reference}</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              {tx.debit > 0 ? `₹${Number(tx.debit).toFixed(2)}` : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'success.main' }}>
                              {tx.credit > 0 ? `₹${Number(tx.credit).toFixed(2)}` : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              ₹{Number(tx.runningBalance).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
};

export default Reports;
