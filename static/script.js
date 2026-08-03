// Auto Invoice Reader - Client Side JavaScript Logic

document.addEventListener('DOMContentLoaded', () => {

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const dropZonePrompt = document.getElementById('dropZonePrompt');
    const previewArea = document.getElementById('previewArea');
    const imagePreview = document.getElementById('imagePreview');
    const pdfPreview = document.getElementById('pdfPreview');
    const fileNameDisplay = document.getElementById('fileName');
    const fileSizeDisplay = document.getElementById('fileSize');
    const changeFileBtn = document.getElementById('changeFileBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const alertContainer = document.getElementById('alertContainer');
    const resultsSection = document.getElementById('resultsSection');

    // Extracted Fields Elements
    const resInvoiceNum = document.getElementById('resInvoiceNum');
    const resInvoiceDate = document.getElementById('resInvoiceDate');
    const resVendor = document.getElementById('resVendor');
    const resGst = document.getElementById('resGst');
    const resTax = document.getElementById('resTax');
    const resTotal = document.getElementById('resTotal');
    const rawOcrText = document.getElementById('rawOcrText');

    // Action Buttons
    const copyTextBtn = document.getElementById('copyTextBtn');
    const downloadJsonBtn = document.getElementById('downloadJsonBtn');
    const downloadTxtBtn = document.getElementById('downloadTxtBtn');

    // Currently selected File & Extracted Data State
    let selectedFile = null;
    let currentExtractedData = null;

    // Allowed File Extensions
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];

    // ==========================================
    // Event Listeners for File Selection
    // ==========================================

    // Trigger file dialog on browse button click
    browseBtn.addEventListener('click', () => fileInput.click());

    // Trigger file dialog when clicking directly on dropZone (if prompt visible)
    dropZonePrompt.addEventListener('click', (e) => {
        if (e.target !== browseBtn && !browseBtn.contains(e.target)) {
            fileInput.click();
        }
    });

    // Handle file selection from file input
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Change file button reset
    changeFileBtn.addEventListener('click', () => {
        resetFileSelection();
    });

    // ==========================================
    // Drag & Drop Handling
    // ==========================================

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    // ==========================================
    // File Processing & Preview Logic
    // ==========================================

    function handleFileSelect(file) {
        const ext = file.name.split('.').pop().toLowerCase();

        // Validate File Extension
        if (!allowedExtensions.includes(ext)) {
            showAlert(`Invalid file format '${file.name}'. Please upload a JPG, JPEG, PNG, or PDF file.`, 'danger');
            resetFileSelection();
            return;
        }

        // Validate File Size (Max 16MB)
        if (file.size > 16 * 1024 * 1024) {
            showAlert(`File '${file.name}' is too large. Maximum file size allowed is 16MB.`, 'warning');
            resetFileSelection();
            return;
        }

        selectedFile = file;

        // Display File Metadata
        fileNameDisplay.textContent = file.name;
        fileSizeDisplay.textContent = formatFileSize(file.size);

        // Hide prompt and show preview container
        dropZonePrompt.classList.add('d-none');
        previewArea.classList.remove('d-none');

        // Render preview based on file type
        if (ext === 'pdf') {
            imagePreview.classList.add('d-none');
            pdfPreview.classList.remove('d-none');
        } else {
            pdfPreview.classList.add('d-none');
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('d-none');
            };
            reader.readAsDataURL(file);
        }

        // Enable process button
        uploadBtn.disabled = false;
        clearAlerts();
    }

    function resetFileSelection() {
        selectedFile = null;
        fileInput.value = '';
        dropZonePrompt.classList.remove('d-none');
        previewArea.classList.add('d-none');
        imagePreview.src = '';
        imagePreview.classList.add('d-none');
        pdfPreview.classList.add('d-none');
        uploadBtn.disabled = true;
        resultsSection.classList.add('d-none');
    }

    // ==========================================
    // Upload & OCR Processing via Fetch API
    // ==========================================

    uploadBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // UI Updates for loading state
        uploadBtn.disabled = true;
        loadingSpinner.classList.remove('d-none');
        resultsSection.classList.add('d-none');
        clearAlerts();

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                currentExtractedData = data;
                displayResults(data);
                showAlert('Invoice processed successfully!', 'success');
            } else {
                showAlert(`Error processing invoice: ${data.error}`, 'danger');
            }
        } catch (error) {
            console.error('Upload Error:', error);
            showAlert('Failed to connect to server. Please ensure the Flask app is running.', 'danger');
        } finally {
            loadingSpinner.classList.add('d-none');
            uploadBtn.disabled = false;
        }
    });

    // ==========================================
    // Results Rendering
    // ==========================================

    function displayResults(data) {
        const fields = data.parsed_fields || {};

        resInvoiceNum.textContent = fields.invoice_number || 'Not Found';
        resInvoiceDate.textContent = fields.invoice_date || 'Not Found';
        resVendor.textContent = fields.vendor_name || 'Not Found';
        resGst.textContent = fields.gst_number || 'Not Found';
        resTax.textContent = fields.tax_amount || 'Not Found';
        resTotal.textContent = fields.total_amount || 'Not Found';

        rawOcrText.value = data.raw_text || 'No text extracted.';

        resultsSection.classList.remove('d-none');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // ==========================================
    // Copy & Download Handlers
    // ==========================================

    // Copy raw OCR text to clipboard
    copyTextBtn.addEventListener('click', () => {
        if (!rawOcrText.value) return;
        navigator.clipboard.writeText(rawOcrText.value).then(() => {
            const originalHTML = copyTextBtn.innerHTML;
            copyTextBtn.innerHTML = '<i class="bi bi-check2 me-1"></i> Copied!';
            copyTextBtn.classList.replace('btn-light', 'btn-success');
            setTimeout(() => {
                copyTextBtn.innerHTML = originalHTML;
                copyTextBtn.classList.replace('btn-success', 'btn-light');
            }, 2000);
        }).catch(err => {
            console.error('Copy failed', err);
        });
    });

    // Download TXT file
    downloadTxtBtn.addEventListener('click', () => {
        if (!currentExtractedData) return;
        downloadFile('/download/txt', { text: currentExtractedData.raw_text });
    });

    // Download JSON file
    downloadJsonBtn.addEventListener('click', () => {
        if (!currentExtractedData) return;
        downloadFile('/download/json', { fields: currentExtractedData.parsed_fields });
    });

    // Helper to post and trigger file download
    async function downloadFile(url, payload) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'download';

            if (contentDisposition && contentDisposition.includes('filename=')) {
                filename = contentDisposition.split('filename=')[1].replace(/["']/g, '');
            }

            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            showAlert('Failed to download file: ' + err.message, 'danger');
        }
    }

    // ==========================================
    // Utility Helper Functions
    // ==========================================

    function showAlert(message, type = 'info') {
        alertContainer.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
                <i class="bi bi-${type === 'success' ? 'check-circle-fill' : type === 'danger' ? 'exclamation-triangle-fill' : 'info-circle-fill'} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }

    function clearAlerts() {
        alertContainer.innerHTML = '';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

});
