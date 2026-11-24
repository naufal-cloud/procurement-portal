import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Upload,
  Search,
  Filter,
  Grid,
  List,
  Plus,
  Trash2,
  Download,
  Eye,
  ShieldCheck,
  LogOut,
  LogIn,
  FileSpreadsheet,
  FileCode,
  FileImage,
  Folder,
  Tag,
  Building2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Archive,
  X,
  ArrowUpDown,
  FileArchive,
  Lock,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  FileDown
} from 'lucide-react';

// --- GOOGLE APPS SCRIPT WEB APP URL (GOOGLE DRIVE BACKEND) ---
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxnEFL_EeJCUA7NCtKULWih-6wtWoLIJH9y26sShOJA7Oc-eyht0jGocgN7ba8B0yUP/exec';

const CATEGORIES = [
  'Kontrak / Perjanjian',
  'Purchase Order (PO)',
  'Invoice / Faktur',
  'Vendor Proposal',
  'RFQ / RFP',
  'BAST'
];

const STATUS_LIST = ['Approved', 'Pending Review', 'Draft', 'Archived'];

// Helper untuk memetakan baris data dari Google Sheets ke format portal
const mapSheetRowToDoc = (row: any) => {
  let meta: any = {};
  if (row.description && typeof row.description === 'string' && row.description.trim().startsWith('{')) {
    try {
      meta = JSON.parse(row.description);
    } catch {
      meta = { notes: row.description };
    }
  } else {
    meta = { notes: row.description || '' };
  }

  const fileName = row.fileName || 'document';
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : (row.fileType || 'pdf');

  return {
    id: String(row.id || ''),
    title: row.title || fileName,
    fileName,
    fileSize: Number(row.fileSize) || 0,
    fileType: ext,
    category: row.category || 'Kontrak / Perjanjian',
    refNumber: meta.refNumber || '-',
    vendor: meta.vendor || '-',
    amount: Number(meta.amount) || 0,
    docDate: meta.docDate || (row.uploadedAt ? String(row.uploadedAt).split('T')[0] : ''),
    uploadDate: row.uploadedAt || new Date().toISOString(),
    uploaderName: row.uploadedBy || 'Procurement Officer',
    uploaderEmail: meta.uploaderEmail || '',
    uploaderId: 'drive-user',
    status: meta.status || 'Pending Review',
    notes: meta.notes || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [row.category || 'Dokumen'],
    fileUrl: row.fileUrl || '',
    driveFileId: row.driveFileId || ''
  };
};

export default function App() {
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [authError, setAuthError] = useState('');

  // Main Documents State
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals & Active Selections
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ msg: string; type: string } | null>(null);

  // Upload Form State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadForm, setUploadForm] = useState<{
    title: string;
    category: string;
    refNumber: string;
    vendor: string;
    amount: string;
    docDate: string;
    notes: string;
    status: string;
    tagsInput: string;
    file: File | null;
  }>({
    title: '',
    category: 'Kontrak / Perjanjian',
    refNumber: '',
    vendor: '',
    amount: '',
    docDate: new Date().toISOString().split('T')[0],
    notes: '',
    status: 'Pending Review',
    tagsInput: '',
    file: null
  });

  // --- LOAD SAVED USER ---
  useEffect(() => {
    const savedUser = localStorage.getItem('procurement_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {}
    }
  }, []);

  // --- FETCH DOCUMENTS FROM GOOGLE DRIVE / SHEETS ---
  const fetchDocumentsFromDrive = async (showNotification = false) => {
    setIsLoadingDocs(true);
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?t=${Date.now()}`);
      const result = await response.json();
      if (result.status === 'success' && Array.isArray(result.data)) {
        const mapped = result.data.map(mapSheetRowToDoc);
        setDocuments(mapped);
        localStorage.setItem('procurement_drive_cache', JSON.stringify(mapped));
        setLastSyncedAt(
          new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        );
        if (showNotification) {
          showToast('Data berhasil disinkronkan dengan Google Drive.');
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data dari Google Drive:', err);
      const cached = localStorage.getItem('procurement_drive_cache');
      if (cached) {
        try {
          setDocuments(JSON.parse(cached));
        } catch {}
      }
      if (showNotification) {
        showToast('Gagal menyinkronkan data. Periksa koneksi internet Anda.', 'error');
      }
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocumentsFromDrive(false);
  }, []);

  // Toast Helper
  const showToast = (msg: string, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Handlers for Authentication
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authForm.email) {
      setAuthError('Email wajib diisi.');
      return;
    }
    const loggedUser = {
      uid: 'user-' + Date.now(),
      email: authForm.email,
      displayName: authForm.name || authForm.email.split('@')[0],
      isAnonymous: false
    };
    setUser(loggedUser);
    localStorage.setItem('procurement_user', JSON.stringify(loggedUser));
    setAuthModalOpen(false);
    showToast(`Selamat datang, ${loggedUser.displayName}!`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('procurement_user');
    showToast('Anda telah keluar dari akun.', 'info');
  };

  // Upload Form Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processSelectedFile(selectedFile);
    }
  };

  const processSelectedFile = (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      showToast('Ukuran file maksimal 25 MB.', 'error');
      return;
    }
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    setUploadForm(prev => ({
      ...prev,
      file,
      title: prev.title || nameWithoutExt
    }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Helper konversi file ke Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = () => reject(new Error('Gagal membaca file dari perangkat.'));
      reader.readAsDataURL(file);
    });
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.isAnonymous) {
      showToast('Anda harus login dengan akun untuk dapat mengunggah file!', 'error');
      setAuthModalOpen(true);
      return;
    }
    if (!uploadForm.file) {
      showToast('Harap pilih berkas yang akan diunggah ke Google Drive!', 'error');
      return;
    }
    if (!uploadForm.title || !uploadForm.vendor || !uploadForm.refNumber) {
      showToast('Harap lengkapi semua field utama (Judul, Vendor, No. Ref)', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      const fileBase64 = await fileToBase64(uploadForm.file);
      setUploadProgress(50);

      const parsedTags = uploadForm.tagsInput
        ? uploadForm.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
        : [uploadForm.category];

      const descriptionPayload = JSON.stringify({
        notes: uploadForm.notes,
        refNumber: uploadForm.refNumber,
        vendor: uploadForm.vendor,
        amount: uploadForm.amount ? parseFloat(uploadForm.amount) : 0,
        docDate: uploadForm.docDate,
        status: uploadForm.status,
        tags: parsedTags,
        uploaderEmail: user.email || ''
      });

      const payload = {
        action: 'upload',
        title: uploadForm.title,
        category: uploadForm.category,
        description: descriptionPayload,
        fileName: uploadForm.file.name,
        fileSize: uploadForm.file.size,
        fileType: uploadForm.file.type || 'application/octet-stream',
        fileBase64,
        uploadedBy: user.displayName || user.email?.split('@')[0] || 'Procurement User'
      };

      setUploadProgress(75);

      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      setUploadProgress(100);

      if (result.status === 'success' && result.data) {
        const createdDoc = mapSheetRowToDoc(result.data);
        setDocuments(prev => {
          const updated = [createdDoc, ...prev];
          localStorage.setItem('procurement_drive_cache', JSON.stringify(updated));
          return updated;
        });

        setUploadModalOpen(false);
        setUploadForm({
          title: '',
          category: 'Kontrak / Perjanjian',
          refNumber: '',
          vendor: '',
          amount: '',
          docDate: new Date().toISOString().split('T')[0],
          notes: '',
          status: 'Pending Review',
          tagsInput: '',
          file: null
        });
        showToast('Berkas berhasil diunggah ke Google Drive!');
      } else {
        throw new Error(result.message || 'Gagal mengunggah ke Google Drive.');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      showToast(err.message || 'Terjadi kesalahan saat mengunggah ke Google Drive.', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!user || user.isAnonymous) {
      showToast('Anda tidak memiliki hak akses untuk menghapus dokumen.', 'error');
      return;
    }
    if (!window.confirm('Apakah Anda yakin ingin menghapus dokumen ini dari Google Drive & portal?')) {
      return;
    }

    const targetDoc = documents.find(d => d.id === docId);

    if (targetDoc?.driveFileId) {
      try {
        showToast('Menghapus berkas dari Google Drive...', 'info');
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'delete', id: docId })
        });
      } catch (err) {
        console.error('Delete Drive error:', err);
      }
    }

    const updated = documents.filter(d => d.id !== docId);
    setDocuments(updated);
    localStorage.setItem('procurement_drive_cache', JSON.stringify(updated));
    setDetailModalOpen(false);
    showToast('Dokumen telah berhasil dihapus.', 'info');
  };

  const handleUpdateStatus = async (docId: string, newStatus: string) => {
    if (!user || user.isAnonymous) {
      showToast('Silakan login untuk memperbarui status dokumen.', 'error');
      return;
    }

    const updatedDocs = documents.map(d => (d.id === docId ? { ...d, status: newStatus } : d));
    setDocuments(updatedDocs);
    localStorage.setItem('procurement_drive_cache', JSON.stringify(updatedDocs));
    if (selectedDoc && selectedDoc.id === docId) {
      setSelectedDoc((prev: any) => ({ ...prev, status: newStatus }));
    }

    setIsUpdatingStatus(true);
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateStatus', id: docId, status: newStatus })
      });
      const result = await response.json();
      if (result.status === 'success') {
        showToast(`Status diubah menjadi "${newStatus}" & tersimpan di Google Drive.`);
      } else {
        showToast('Status berubah di tampilan, namun gagal menyinkronkan ke server.', 'error');
      }
    } catch (err) {
      console.error('Update status error:', err);
      showToast('Status berubah secara lokal. Periksa koneksi untuk sinkronisasi.', 'info');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Download & Copy Drive Link
  const handleDownload = (docItem: any) => {
    if (docItem.driveFileId) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${docItem.driveFileId}`;
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      showToast(`Mengunduh berkas dari Google Drive: ${docItem.fileName}`);
    } else if (docItem.fileUrl) {
      window.open(docItem.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyDriveLink = async (url: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      showToast('Link Google Drive berhasil disalin!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('Gagal menyalin link.', 'error');
    }
  };

  // Export Rekap CSV
  const handleExportCSV = () => {
    if (filteredDocuments.length === 0) {
      showToast('Tidak ada data dokumen untuk diekspor.', 'info');
      return;
    }
    const headers = [
      'Judul Dokumen',
      'Nama File',
      'Kategori',
      'No. Referensi',
      'Vendor',
      'Nominal (IDR)',
      'Tanggal Dokumen',
      'Status',
      'Pengunggah',
      'Link Google Drive'
    ];
    const rows = filteredDocuments.map(d => [
      `"${(d.title || '').replace(/"/g, '""')}"`,
      `"${(d.fileName || '').replace(/"/g, '""')}"`,
      `"${(d.category || '').replace(/"/g, '""')}"`,
      `"${(d.refNumber || '').replace(/"/g, '""')}"`,
      `"${(d.vendor || '').replace(/"/g, '""')}"`,
      d.amount || 0,
      `"${d.docDate || ''}"`,
      `"${d.status || ''}"`,
      `"${(d.uploaderName || '').replace(/"/g, '""')}"`,
      `"${d.fileUrl || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rekap_Dokumen_Procurement_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Rekap dokumen berhasil diunduh (CSV).');
  };

  // Filtered and Sorted Documents
  const filteredDocuments = useMemo(() => {
    return documents
      .filter(d => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !q ||
          d.title?.toLowerCase().includes(q) ||
          d.refNumber?.toLowerCase().includes(q) ||
          d.vendor?.toLowerCase().includes(q) ||
          d.notes?.toLowerCase().includes(q) ||
          d.tags?.some((tag: string) => tag.toLowerCase().includes(q));
        const matchesCategory = selectedCategory === 'All' || d.category === selectedCategory;
        const matchesStatus = selectedStatus === 'All' || d.status === selectedStatus;
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.docDate || 0).getTime() - new Date(a.docDate || 0).getTime();
        if (sortBy === 'date-asc') return new Date(a.docDate || 0).getTime() - new Date(b.docDate || 0).getTime();
        if (sortBy === 'name-asc') return (a.title || '').localeCompare(b.title || '');
        if (sortBy === 'name-desc') return (b.title || '').localeCompare(a.title || '');
        if (sortBy === 'amount-desc') return (b.amount || 0) - (a.amount || 0);
        if (sortBy === 'size-desc') return (b.fileSize || 0) - (a.fileSize || 0);
        return 0;
      });
  }, [documents, searchQuery, selectedCategory, selectedStatus, sortBy]);

  // General Dashboard Statistics
  const stats = useMemo(() => {
    const totalDocs = documents.length;
    const totalAmount = documents.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const pendingCount = documents.filter(d => d.status === 'Pending Review').length;
    const approvedCount = documents.filter(d => d.status === 'Approved').length;
    const vendorsCount = new Set(documents.map(d => d.vendor).filter(v => v && v !== '-')).size;
    return { totalDocs, totalAmount, pendingCount, approvedCount, vendorsCount };
  }, [documents]);

  // Formatters
  const formatIDR = (val: number) => {
    if (!val) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileTypeBadge = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('pdf')) return { color: 'bg-rose-100 text-rose-700 border-rose-200', label: 'PDF', icon: FileText };
    if (t.includes('xls') || t.includes('sheet') || t.includes('csv'))
      return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'XLSX', icon: FileSpreadsheet };
    if (t.includes('doc')) return { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'DOCX', icon: FileText };
    if (t.includes('jpg') || t.includes('png') || t.includes('jpeg'))
      return { color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'IMG', icon: FileImage };
    if (t.includes('zip') || t.includes('rar'))
      return { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'ZIP', icon: FileArchive };
    return { color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'FILE', icon: Folder };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} /> Approved
          </span>
        );
      case 'Pending Review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={13} /> Pending Review
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <FileCode size={13} /> Draft
          </span>
        );
      case 'Archived':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300">
            <Archive size={13} /> Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-900 border-rose-700 text-rose-100'
              : toastMessage.type === 'info'
              ? 'bg-slate-800 border-slate-600 text-slate-100'
              : 'bg-emerald-950 border-emerald-700 text-emerald-100'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle size={18} className="text-rose-400" />
          ) : (
            <CheckCircle2 size={18} className="text-emerald-400" />
          )}
          <span>{toastMessage.msg}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Portal Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg leading-tight tracking-tight text-white">ProcureDoc</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                  Google Drive Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">Sistem Manajemen Dokumen & Arsip Pengadaan</p>
            </div>
          </div>

          {/* Quick Search Header Bar */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari file, PO, vendor, atau tag..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* User & Auth Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchDocumentsFromDrive(true)}
              disabled={isLoadingDocs}
              title="Sinkronkan ulang dari Google Drive"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoadingDocs ? 'animate-spin text-indigo-400' : ''} />
            </button>

            {user && !user.isAnonymous ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-sm font-medium text-slate-200">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[11px] text-emerald-400 flex items-center justify-end gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Procurement Officer
                  </span>
                </div>
                <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-semibold text-sm">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
                <button
                  onClick={handleLogout}
                  title="Keluar / Logout"
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block text-xs text-slate-400 mr-1">Tamu (Read-Only)</span>
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
                >
                  <LogIn size={15} /> Masuk Akun
                </button>
              </div>
            )}

            <button
              onClick={() => {
                if (!user || user.isAnonymous) {
                  showToast('Silakan masuk dengan akun untuk mengunggah dokumen baru.', 'info');
                  setAuthModalOpen(true);
                } else {
                  setUploadModalOpen(true);
                }
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={16} /> Unggah File
            </button>
          </div>
        </div>
      </header>

      {/* GUEST BANNER ALERT */}
      {(!user || user.isAnonymous) && (
        <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2.5 text-center text-xs text-amber-200/90 flex items-center justify-center gap-2">
          <Lock size={14} className="text-amber-400 shrink-0" />
          <span>
            Anda mengakses sebagai <strong>Guest Viewer</strong> (hanya lihat & unduh). Untuk mengunggah dokumen atau
            mengubah status, silakan
          </span>
          <button
            onClick={() => {
              setAuthMode('login');
              setAuthModalOpen(true);
            }}
            className="underline font-bold text-amber-300 hover:text-amber-100"
          >
            Masuk Akun Pengadaan
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium text-slate-400">Total Dokumentasi</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-1">
                {stats.totalDocs} <span className="text-xs font-normal text-slate-400">File</span>
              </h3>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} /> {stats.approvedCount} Disetujui
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Folder size={24} />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium text-slate-400">Est. Total Nilai PO / Kontrak</p>
              <h3 className="text-xl font-bold text-emerald-400 mt-1">{formatIDR(stats.totalAmount)}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Akumulasi dokumen terdaftar</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign size={24} />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium text-slate-400">Pending Review</p>
              <h3 className="text-2xl font-bold text-amber-400 mt-1">
                {stats.pendingCount} <span className="text-xs font-normal text-slate-400">Berkas</span>
              </h3>
              <p className="text-[11px] text-amber-400/80 mt-1">Membutuhkan verifikasi tim</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock size={24} />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium text-slate-400">Vendor Terkait</p>
              <h3 className="text-2xl font-bold text-purple-400 mt-1">
                {stats.vendorsCount} <span className="text-xs font-normal text-slate-400">Entitas</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Rekanan aktif tercatat</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Building2 size={24} />
            </div>
          </div>
        </div>

        {/* SEARCH, FILTER & VIEW CONTROLS */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Mobile Search */}
            <div className="w-full md:hidden mb-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari file, PO, vendor..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200"
                />
              </div>
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-300">
              <Filter size={14} className="text-indigo-400" />
              <span className="text-slate-400">Kategori:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="All" className="bg-slate-900 text-slate-200">
                  Semua Kategori
                </option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat} className="bg-slate-900 text-slate-200">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-300">
              <span className="text-slate-400">Status:</span>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="All" className="bg-slate-900 text-slate-200">
                  Semua Status
                </option>
                {STATUS_LIST.map(st => (
                  <option key={st} value={st} className="bg-slate-900 text-slate-200">
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-300">
              <ArrowUpDown size={14} className="text-slate-400" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-transparent text-slate-100 font-medium focus:outline-none cursor-pointer"
              >
                <option value="date-desc" className="bg-slate-900">
                  Tanggal Terbaru
                </option>
                <option value="date-asc" className="bg-slate-900">
                  Tanggal Terlama
                </option>
                <option value="name-asc" className="bg-slate-900">
                  Nama A-Z
                </option>
                <option value="name-desc" className="bg-slate-900">
                  Nama Z-A
                </option>
                <option value="amount-desc" className="bg-slate-900">
                  Nominal Tertinggi
                </option>
                <option value="size-desc" className="bg-slate-900">
                  Ukuran Terbesar
                </option>
              </select>
            </div>
          </div>

          {/* Right Controls: Export CSV + View Toggle */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={handleExportCSV}
              title="Unduh rekap data ke Excel / CSV"
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            >
              <FileDown size={15} className="text-emerald-400" /> Export Rekap
            </button>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List size={15} /> Tabel
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'grid' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Grid size={15} /> Kartu Grid
              </button>
            </div>
          </div>
        </div>

        {/* RESULTS SUMMARY BAR */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            {isLoadingDocs && documents.length === 0 ? (
              'Menyinkronkan arsip dengan Google Drive...'
            ) : (
              <>
                Menampilkan <strong className="text-slate-200">{filteredDocuments.length}</strong> dari {documents.length}{' '}
                dokumen {lastSyncedAt && <span className="text-slate-500">• Sinkron terakhir {lastSyncedAt}</span>}
              </>
            )}
          </span>
          {(searchQuery || selectedCategory !== 'All' || selectedStatus !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedStatus('All');
              }}
              className="text-indigo-400 hover:underline flex items-center gap-1"
            >
              <X size={12} /> Reset Filter
            </button>
          )}
        </div>

        {/* DOCUMENT LIST CONTAINER */}
        {isLoadingDocs && documents.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/60 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <RefreshCw size={32} className="text-indigo-400 animate-spin mb-3" />
            <h4 className="text-sm font-semibold text-slate-200">Memuat Dokumen dari Google Drive...</h4>
            <p className="text-xs text-slate-400 mt-1">Mohon tunggu sebentar</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/60 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 mb-4">
              <Folder size={32} />
            </div>
            <h4 className="text-base font-semibold text-slate-200">
              {documents.length === 0 ? 'Belum Ada Dokumen Tersimpan' : 'Tidak Ada Dokumen Ditemukan'}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              {documents.length === 0
                ? 'Klik tombol "+ Unggah File" di pojok kanan atas untuk mulai mengarsipkan dokumen ke Google Drive.'
                : 'Coba sesuaikan kata kunci pencarian atau ganti filter kategori/status Anda.'}
            </p>
            {documents.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setSelectedStatus('All');
                }}
                className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-all"
              >
                Bersihkan Filter
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* TABLE VIEW */
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-700/80 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Nama Dokumen & File</th>
                    <th className="py-3.5 px-4">Kategori</th>
                    <th className="py-3.5 px-4">No. Ref / Vendor</th>
                    <th className="py-3.5 px-4">Nilai (IDR)</th>
                    <th className="py-3.5 px-4">Tanggal</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40 text-slate-200">
                  {filteredDocuments.map(docItem => {
                    const typeBadge = getFileTypeBadge(docItem.fileType);
                    const TypeIcon = typeBadge.icon;
                    return (
                      <tr
                        key={docItem.id}
                        className="hover:bg-slate-700/30 transition-colors group cursor-pointer"
                        onClick={() => {
                          setSelectedDoc(docItem);
                          setCopiedLink(false);
                          setDetailModalOpen(true);
                        }}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${typeBadge.color}`}
                            >
                              <TypeIcon size={18} />
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <h4 className="font-semibold text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                                {docItem.title}
                              </h4>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                <span className="truncate">{docItem.fileName}</span>
                                <span>•</span>
                                <span>{formatFileSize(docItem.fileSize)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900/80 text-slate-300 border border-slate-700">
                            {docItem.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200">{docItem.vendor}</div>
                          <div className="text-[11px] font-mono text-slate-400">{docItem.refNumber}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-200">
                          {docItem.amount ? formatIDR(docItem.amount) : '-'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">{docItem.docDate || 'N/A'}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(docItem.status)}</td>
                        <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedDoc(docItem);
                                setCopiedLink(false);
                                setDetailModalOpen(true);
                              }}
                              title="Lihat Detail"
                              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/60 rounded-lg transition-all"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleDownload(docItem)}
                              title="Unduh File"
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 rounded-lg transition-all"
                            >
                              <Download size={16} />
                            </button>
                            {user && !user.isAnonymous && (
                              <button
                                onClick={() => handleDeleteDocument(docItem.id)}
                                title="Hapus Dokumen"
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* GRID / CARD VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map(docItem => {
              const typeBadge = getFileTypeBadge(docItem.fileType);
              const TypeIcon = typeBadge.icon;
              return (
                <div
                  key={docItem.id}
                  onClick={() => {
                    setSelectedDoc(docItem);
                    setCopiedLink(false);
                    setDetailModalOpen(true);
                  }}
                  className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 group cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${typeBadge.color}`}>
                        <TypeIcon size={20} />
                      </div>
                      <div>{getStatusBadge(docItem.status)}</div>
                    </div>
                    <h4 className="font-semibold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
                      {docItem.title}
                    </h4>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Building2 size={13} className="text-slate-500 shrink-0" />
                        <span className="truncate">{docItem.vendor}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Tag size={13} className="text-slate-500 shrink-0" />
                        <span>{docItem.category}</span>
                      </div>
                    </div>
                    {docItem.tags && docItem.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {docItem.tags.slice(0, 3).map((tg: string, idx: number) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md border border-slate-700/50"
                          >
                            #{tg}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[11px] text-slate-400 font-mono">{docItem.refNumber}</div>
                      <div className="font-bold text-slate-200 mt-0.5">
                        {docItem.amount ? formatIDR(docItem.amount) : formatFileSize(docItem.fileSize)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleDownload(docItem)}
                        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-all"
                        title="Unduh File"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 ProcureDoc — Sistem Manajemen Dokumen & Arsip Pengadaan</p>
          <div className="flex items-center gap-2 text-emerald-400/90">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Terhubung ke Google Drive</span>
          </div>
        </div>
      </footer>

      {/* --- UPLOAD FILE MODAL --- */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Upload size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">Unggah Dokumen ke Google Drive</h3>
                  <p className="text-xs text-slate-400">Berkas akan otomatis disimpan ke folder arsip Google Drive</p>
                </div>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-950/40 hover:border-slate-600'
                }`}
              >
                <input type="file" id="file-upload" onChange={handleFileSelect} className="hidden" />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 mb-2">
                    <Upload size={22} />
                  </div>
                  {uploadForm.file ? (
                    <div>
                      <p className="text-sm font-semibold text-emerald-400">{uploadForm.file.name}</p>
                      <p className="text-xs text-slate-400">{formatFileSize(uploadForm.file.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Tarik berkas ke sini atau{' '}
                        <span className="text-indigo-400 underline font-semibold">Pilih Berkas</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Mendukung PDF, XLSX, DOCX, PNG, JPG, ZIP (Maks 25MB)</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Mengirim berkas ke Google Drive...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Form Grid Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Judul Dokumen *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kontrak Perjanjian Pengadaan Server 2026"
                    value={uploadForm.title}
                    onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Kategori Dokumen *</label>
                  <select
                    value={uploadForm.category}
                    onChange={e => setUploadForm({ ...uploadForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nomor Referensi / PO *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PO-2026-9901 atau KTR-004"
                    value={uploadForm.refNumber}
                    onChange={e => setUploadForm({ ...uploadForm, refNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Vendor / Rekanan *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PT Solusi Teknologi Nusantara"
                    value={uploadForm.vendor}
                    onChange={e => setUploadForm({ ...uploadForm, vendor: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nominal Kontrak / PO (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Contoh: 150000000"
                    value={uploadForm.amount}
                    onChange={e => setUploadForm({ ...uploadForm, amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {uploadForm.amount && Number(uploadForm.amount) > 0 && (
                    <p className="text-[11px] text-emerald-400 mt-1 font-medium">
                      Terbaca: {formatIDR(Number(uploadForm.amount))}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tanggal Dokumen</label>
                  <input
                    type="date"
                    value={uploadForm.docDate}
                    onChange={e => setUploadForm({ ...uploadForm, docDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status Dokumen</label>
                  <select
                    value={uploadForm.status}
                    onChange={e => setUploadForm({ ...uploadForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {STATUS_LIST.map(st => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tag (Pisahkan dengan koma)</label>
                  <input
                    type="text"
                    placeholder="Hardware, Server, High Value, Q1 2026"
                    value={uploadForm.tagsInput}
                    onChange={e => setUploadForm({ ...uploadForm, tagsInput: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Catatan / Deskripsi Singkat</label>
                  <textarea
                    rows={3}
                    placeholder="Tambahkan penjelasan, ruang lingkup, atau instruksi penanganan..."
                    value={uploadForm.notes}
                    onChange={e => setUploadForm({ ...uploadForm, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/20 transition-all"
                >
                  {isUploading ? 'Mengunggah ke Drive...' : 'Simpan & Unggah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DETAIL / PREVIEW MODAL --- */}
      {detailModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                    getFileTypeBadge(selectedDoc.fileType).color
                  }`}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">{selectedDoc.title}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedDoc.fileName} • {formatFileSize(selectedDoc.fileSize)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Status Dokumen</span>
                  {getStatusBadge(selectedDoc.status)}
                </div>
                {user && !user.isAnonymous && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {isUpdatingStatus ? 'Menyimpan...' : 'Ubah Status:'}
                    </span>
                    <select
                      value={selectedDoc.status}
                      disabled={isUpdatingStatus}
                      onChange={e => handleUpdateStatus(selectedDoc.id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                      {STATUS_LIST.map(st => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 block mb-0.5">Nomor Referensi</span>
                  <span className="font-mono font-bold text-slate-200">{selectedDoc.refNumber}</span>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 block mb-0.5">Nama Vendor</span>
                  <span className="font-semibold text-slate-200">{selectedDoc.vendor}</span>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 block mb-0.5">Kategori</span>
                  <span className="font-medium text-indigo-300">{selectedDoc.category}</span>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 block mb-0.5">Nilai Kontrak / PO</span>
                  <span className="font-bold text-emerald-400">
                    {selectedDoc.amount ? formatIDR(selectedDoc.amount) : 'Tidak Tercantum'}
                  </span>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 block mb-0.5">Tanggal Dokumen</span>
                  <span className="font-medium text-slate-200">{selectedDoc.docDate || '-'}</span>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-slate-400 block mb-0.5">Pengunggah</span>
                  <span className="font-medium text-slate-200">{selectedDoc.uploaderName}</span>
                </div>
              </div>

              {selectedDoc.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Catatan & Deskripsi
                  </h4>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    {selectedDoc.notes}
                  </div>
                </div>
              )}

              {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Label / Tag</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDoc.tags.map((tg: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700"
                      >
                        #{tg}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Google Drive Actions */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                  <FileText size={24} />
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-slate-200">Arsip Digital Google Drive</h5>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedDoc.fileName}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  {selectedDoc.fileUrl && (
                    <>
                      <a
                        href={selectedDoc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                      >
                        <ExternalLink size={14} /> Buka di Drive
                      </a>
                      <button
                        onClick={() => handleCopyDriveLink(selectedDoc.fileUrl)}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                      >
                        {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copiedLink ? 'Link Tersalin' : 'Salin Link'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDownload(selectedDoc)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                  >
                    <Download size={14} /> Unduh Berkas
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950">
              {user && !user.isAnonymous ? (
                <button
                  onClick={() => handleDeleteDocument(selectedDoc.id)}
                  className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 size={14} /> Hapus Dokumen
                </button>
              ) : (
                <div></div>
              )}

              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- AUTHENTICATION MODAL (LOGIN / SIGNUP) --- */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 pb-4 border-b border-slate-800 text-center relative">
              <button
                onClick={() => setAuthModalOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-200"
              >
                <X size={18} />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={26} />
              </div>
              <h3 className="font-bold text-lg text-slate-100">
                {authMode === 'login' ? 'Masuk ke Portal Procurement' : 'Daftar Akun Officer'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Akses penuh untuk pengunggahan dan pengelolaan arsip</p>
            </div>

            <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">
              {authError && (
                <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-400" />
                  <span>{authError}</span>
                </div>
              )}
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahmad Subagja"
                    value={authForm.name}
                    onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Perusahaan</label>
                <input
                  type="email"
                  required
                  placeholder="nama@perusahaan.co.id"
                  value={authForm.email}
                  onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Kata Sandi</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all mt-2"
              >
                {authMode === 'login' ? 'Masuk Sekarang' : 'Buat Akun Baruku'}
              </button>

              <div className="text-center pt-3 border-t border-slate-800 text-xs text-slate-400">
                {authMode === 'login' ? (
                  <span>
                    Belum punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      className="text-indigo-400 font-semibold hover:underline"
                    >
                      Daftar di sini
                    </button>
                  </span>
                ) : (
                  <span>
                    Sudah memiliki akun?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-indigo-400 font-semibold hover:underline"
                    >
                      Masuk ke akun
                    </button>
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
