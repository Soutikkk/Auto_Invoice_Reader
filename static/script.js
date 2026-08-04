// ============================================
// AUTO INVOICE READER - Beginner Friendly Version
// ============================================

// Wait for the page to load before running any code
document.addEventListener('DOMContentLoaded', function() {

    // ============================================
    // 1. GET ALL THE HTML ELEMENTS WE NEED
    // ============================================
    
    // Main drop zone where users drag files
    const dropZone = document.getElementById('dropZone');
    
    // Hidden file input that opens when user clicks
    const fileInput = document.getElementById('fileInput');
    
    // Button to browse files
    const browseBtn = document.getElementById('browseBtn');
    
    // The prompt text shown when no file is selected
    const dropZonePrompt = document.getElementById('dropZonePrompt');
    
    // Area that shows file preview
    const previewArea = document.getElementById('previewArea');
    
    // Image preview element
    const imagePreview = document.getElementById('imagePreview');
    
    // PDF preview element
    const pdfPreview = document.getElementById('pdfPreview');
    
    // Display file name
    const fileNameDisplay = document.getElementById('fileName');
    
    // Display file size
    const fileSizeDisplay = document.getElementById('fileSize');
    
    // Button to change the file
    const changeFileBtn = document.getElementById('changeFileBtn');
    
    // Button to upload the file
    const uploadBtn = document.getElementById('uploadBtn');
    
    // Loading spinner animation
    const loadingSpinner = document.getElementById('loadingSpinner');
    
    // Where alerts (messages) appear
    const alertContainer = document.getElementById('alertContainer');
    
    // Where results are shown
    const resultsSection = document.getElementById('resultsSection');

    // ============================================
    // 2. SET UP OUR SETTINGS (CONFIGURATION)
    // ============================================
    
    // Maximum file size: 10MB (10 * 1024 * 1024 bytes)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    
    // Which file types are allowed
    const ALLOWED_TYPES = [
        'image/jpeg',    // .jpg
        'image/jpg',     // .jpg
        'image/png',     // .png
        'image/webp',    // .webp
        'application/pdf' // .pdf
    ];

    // This variable will store the file the user selects
    let selectedFile = null;
    
    // This tracks if we're currently uploading
    let isUploading = false;

    // ============================================
    // 3. HELPER FUNCTIONS (Small tools)
    // ============================================
    
    // Convert bytes to a readable format (e.g., "2.5 MB")
    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' B';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        }
    }

    // Show a message to the user
    function showMessage(message, type) {
        // Create a new alert div
        const alert = document.createElement('div');
        alert.className = 'alert alert-' + type;
        alert.textContent = message;
        
        // Add it to the alert container
        alertContainer.appendChild(alert);
        
        // Auto-remove after 5 seconds
        setTimeout(function() {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    // Clear all messages
    function clearMessages() {
        alertContainer.innerHTML = '';
    }

    // ============================================
    // 4. FILE VALIDATION (Check if file is okay)
    // ============================================
    
    function isValidFile(file) {
        // Check 1: Is there a file?
        if (!file) {
            showMessage('Please select a file.', 'warning');
            return false;
        }
        
        // Check 2: Is it a supported type?
        if (!ALLOWED_TYPES.includes(file.type)) {
            showMessage('Only JPG, PNG, and PDF files are allowed.', 'danger');
            return false;
        }
        
        // Check 3: Is it too big?
        if (file.size > MAX_FILE_SIZE) {
            const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
            showMessage('File is too big (' + sizeInMB + 'MB). Max size is 10MB.', 'danger');
            return false;
        }
        
        // All checks passed!
        return true;
    }

    // ============================================
    // 5. SHOW FILE PREVIEW
    // ============================================
    
    function showPreview(file) {
        // Show file name and size
        fileNameDisplay.textContent = file.name;
        fileSizeDisplay.textContent = formatFileSize(file.size);
        
        // Hide the prompt, show the preview area
        dropZonePrompt.style.display = 'none';
        previewArea.style.display = 'block';
        
        // Check if it's an image
        if (file.type.startsWith('image/')) {
            // Show image preview
            imagePreview.style.display = 'block';
            pdfPreview.style.display = 'none';
            
            // Read the file as a data URL (so we can show it)
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
        
        // Check if it's a PDF
        if (file.type === 'application/pdf') {
            // Show PDF preview
            pdfPreview.style.display = 'block';
            imagePreview.style.display = 'none';
            
            // Read the file as a data URL
            const reader = new FileReader();
            reader.onload = function(e) {
                pdfPreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
        
        // Enable the upload button
        uploadBtn.disabled = false;
    }

    // Clear everything when we want to start over
    function clearPreview() {
        // Hide preview, show prompt
        previewArea.style.display = 'none';
        dropZonePrompt.style.display = 'block';
        
        // Clear the images
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        pdfPreview.src = '';
        pdfPreview.style.display = 'none';
        
        // Clear text
        fileNameDisplay.textContent = '';
        fileSizeDisplay.textContent = '';
        
        // Disable upload button
        uploadBtn.disabled = true;
        
        // Clear the file
        selectedFile = null;
        fileInput.value = '';
    }

    // ============================================
    // 6. HANDLE FILE SELECTION
    // ============================================
    
    function handleFile(file) {
        // Remove old messages
        clearMessages();
        
        // Check if file is valid
        if (!isValidFile(file)) {
            clearPreview();
            return;
        }
        
        // Save the file
        selectedFile = file;
        
        // Show the preview
        showPreview(file);
    }

    // ============================================
    // 7. DRAG AND DROP EVENTS
    // ============================================
    
    // When a file is dragged over the drop zone
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault(); // Prevent browser from opening the file
        dropZone.style.borderColor = '#007bff';
        dropZone.style.backgroundColor = '#f0f8ff';
    });

    // When a file is dragged out of the drop zone
    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropZone.style.borderColor = '#dee2e6';
        dropZone.style.backgroundColor = '#f8f9fa';
    });

    // When a file is dropped
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        
        // Reset styles
        dropZone.style.borderColor = '#dee2e6';
        dropZone.style.backgroundColor = '#f8f9fa';
        
        // Get the dropped file
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
            
            // Also update the file input (so it matches)
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(files[0]);
            fileInput.files = dataTransfer.files;
        }
    });

    // ============================================
    // 8. BROWSE BUTTON AND FILE INPUT
    // ============================================
    
    // Click on drop zone opens file picker
    dropZone.addEventListener('click', function() {
        if (!isUploading) {
            fileInput.click();
        }
    });

    // Browse button opens file picker
    browseBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent the drop zone click
        if (!isUploading) {
            fileInput.click();
        }
    });

    // When user selects a file via the file picker
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });

    // Change file button
    changeFileBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!isUploading) {
            clearPreview();
            fileInput.click();
        }
    });

    // ============================================
    // 9. UPLOAD THE FILE TO THE SERVER
    // ============================================
    
    uploadBtn.addEventListener('click', async function() {
        // Make sure we have a file and we're not already uploading
        if (!selectedFile || isUploading) {
            return;
        }
        
        // Start uploading
        isUploading = true;
        uploadBtn.disabled = true;
        loadingSpinner.style.display = 'inline-block';
        
        // Create a FormData object (used to send files)
        const formData = new FormData();
        formData.append('invoice', selectedFile);
        
        try {
            // Send the file to the server
            const response = await fetch('/api/upload-invoice', {
                method: 'POST',
                body: formData
            });
            
            // Get the response as JSON
            const result = await response.json();
            
            // Check if upload was successful
            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }
            
            // Success! Show the results
            showMessage('Invoice processed successfully!', 'success');
            displayResults(result);
            
        } catch (error) {
            // Something went wrong
            console.error('Upload error:', error);
            showMessage('Upload failed: ' + error.message, 'danger');
            
            // Reset the upload state
            uploadBtn.disabled = false;
            loadingSpinner.style.display = 'none';
            isUploading = false;
        }
    });

    // ============================================
    // 10. DISPLAY THE RESULTS
    // ============================================
    
    function displayResults(data) {
        // Hide the loading spinner
        loadingSpinner.style.display = 'none';
        uploadBtn.disabled = false;
        isUploading = false;
        
        // Get the container where we'll show results
        let container = document.getElementById('resultsContainer');
        
        // Create it if it doesn't exist
        if (!container) {
            container = document.createElement('div');
            container.id = 'resultsContainer';
            container.className = 'mt-4 p-4 border rounded';
            container.style.backgroundColor = '#f8f9fa';
            resultsSection.appendChild(container);
        }
        
        // Build the HTML for the results
        let html = '<h3>Extracted Invoice Data</h3>';
        html += '<div style="overflow-x: auto;">';
        html += '<table style="width: 100%; border-collapse: collapse;">';
        
        // List of fields to display
        const fields = [
            { key: 'invoiceNumber', label: 'Invoice Number' },
            { key: 'invoiceDate', label: 'Invoice Date' },
            { key: 'dueDate', label: 'Due Date' },
            { key: 'vendorName', label: 'Vendor Name' },
            { key: 'vendorAddress', label: 'Vendor Address' },
            { key: 'clientName', label: 'Client Name' },
            { key: 'clientAddress', label: 'Client Address' },
            { key: 'totalAmount', label: 'Total Amount' },
            { key: 'subtotal', label: 'Subtotal' },
            { key: 'taxAmount', label: 'Tax Amount' },
            { key: 'currency', label: 'Currency' }
        ];
        
        let hasData = false;
        
        // Go through each field
        fields.forEach(function(field) {
            const value = data[field.key];
            
            // If there's a value, show it
            if (value && value !== '' && value !== null) {
                hasData = true;
                html += '<tr style="border-bottom: 1px solid #dee2e6;">';
                html += '<td style="padding: 10px; font-weight: bold; width: 40%;">' + field.label + '</td>';
                html += '<td style="padding: 10px;">' + escapeHtml(value) + '</td>';
                html += '</tr>';
            }
        });
        
        // If no data was found
        if (!hasData) {
            html += '<tr><td colspan="2" style="padding: 20px; text-align: center; color: #6c757d;">';
            html += 'No invoice data could be extracted.';
            html += '</td></tr>';
        }
        
        html += '</table>';
        html += '</div>';
        
        // Add a "Process Another" button
        html += '<div style="margin-top: 20px;">';
        html += '<button onclick="location.reload()" class="btn btn-primary">Process Another Invoice</button>';
        html += '</div>';
        
        // Show the results
        container.innerHTML = html;
        resultsSection.style.display = 'block';
        
        // Scroll to the results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // ============================================
    // 11. SAFETY: Prevent XSS attacks
    // ============================================
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    // ============================================
    // 12. STARTUP: Set initial state
    // ============================================
    
    // Disable upload button until a file is selected
    uploadBtn.disabled = true;
    
    // Hide the loading spinner
    loadingSpinner.style.display = 'none';
    
    // Hide results section
    resultsSection.style.display = 'none';
    
    console.log('📄 Auto Invoice Reader is ready!');

}); // End of DOMContentLoaded
