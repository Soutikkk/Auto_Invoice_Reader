# Auto Invoice Reader 📄🔍

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Framework-Flask-green.svg)](https://flask.palletsprojects.com/)
[![OCR](https://img.shields.io/badge/OCR-Tesseract-orange.svg)](https://github.com/tesseract-ocr/tesseract)
[![Bootstrap](https://img.shields.io/badge/UI-Bootstrap%205-purple.svg)](https://getbootstrap.com/)
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)

A beginner-friendly, high-performance Flask web application designed to automatically scan, extract, and structure key information from invoice documents (JPG, JPEG, PNG, and PDF). Powered by **Tesseract OCR**, **Pillow**, **pdf2image**, and regular expression field parsing.

---

## ✨ Features

- 📤 **Drag & Drop Interface**: Modern Bootstrap 5 single-page application with interactive drag-and-drop file upload.
- 🖼️ **File Format Support**: Accepts `.jpg`, `.jpeg`, `.png`, and `.pdf` files.
- 📄 **PDF Processing**: Automatically converts the first page of PDF invoices to high-resolution images using `pdf2image`.
- 🔍 **Automated OCR**: Scans and extracts complete raw text using `pytesseract`.
- 🤖 **Regex Field Extraction**: Intelligent regular expressions automatically parse key fields:
  - 🆔 **Invoice Number**
  - 📅 **Invoice Date**
  - 🏢 **Vendor / Company Name**
  - 🏷️ **GST Number (GSTIN)**
  - 💵 **Tax Amount**
  - 💰 **Total Amount**
- 💾 **Data Export**:
  - 📋 **Copy to Clipboard**: One-click raw OCR text copy.
  - 📝 **Download TXT**: Export complete OCR text as a `.txt` file.
  - 📊 **Download JSON**: Export extracted invoice details as a structured `.json` file.
- 🧹 **Automatic Cleanup**: Temporary uploaded files are safely deleted immediately after processing.

---

## 📁 Project Structure

```text
AutoInvoiceReader/
│
├── app.py              # Main Flask application with OCR & regex parsing logic
├── requirements.txt    # Python package dependencies
├── .gitignore          # Git ignore configuration
├── uploads/            # Temporary storage directory for uploaded files (.gitkeep)
├── templates/
│   └── index.html      # Bootstrap 5 single-page interface
├── static/
│   ├── style.css       # Custom styling, drag-and-drop animations
│   └── script.js       # Client-side JavaScript (Drag & drop, Fetch API, download handlers)
└── README.md           # Setup, usage, and troubleshooting guide
```

---

## 🛠️ Step-by-Step Installation Guide

### 1. Prerequisites
- **Python 3.8+** installed on your system.
- **Tesseract OCR** engine installed (Required for Optical Character Recognition).
- **Poppler** (Required if you want to process PDF invoices).

---

### 2. Installing Tesseract OCR (Required)

#### 🔹 On Windows:
1. Download the Tesseract Windows installer: [UB-Mannheim Tesseract Wiki](https://github.com/UB-Mannheim/tesseract/wiki).
2. Run the installer. The default path is usually `C:\Program Files\Tesseract-OCR\tesseract.exe`.
3. Add Tesseract to your Environment Variables:
   - Search **"Environment Variables"** in the Windows Start menu.
   - Edit the `PATH` variable under System Variables.
   - Add `C:\Program Files\Tesseract-OCR`.
4. *Note:* `app.py` auto-detects standard Windows Tesseract installation paths if not found in PATH!

#### 🔹 On Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install tesseract-ocr
```

#### 🔹 On macOS:
```bash
brew install tesseract
```

---

### 3. Installing Poppler (Required for PDF files)

#### 🔹 On Windows:
1. Download Poppler for Windows zip package from [Poppler Releases](https://github.com/oschwartz10612/poppler-windows/releases/).
2. Extract to a directory (e.g. `C:\Program Files\poppler`).
3. Add the `bin` folder (e.g. `C:\Program Files\poppler\Library\bin`) to your Windows `PATH` environment variable.

#### 🔹 On Linux:
```bash
sudo apt install poppler-utils
```

#### 🔹 On macOS:
```bash
brew install poppler
```

---

### 4. Project Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Soutikkk/Auto_Invoice_Reader.git
   cd Auto_Invoice_Reader
   ```

2. **(Optional) Create a virtual environment:**
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

---

## 🚀 Running the Application

1. Start the Flask server:
   ```bash
   python app.py
   ```

2. Open your browser and navigate to:
   ```text
   http://127.0.0.1:5000
   ```

---

## 🌐 API Endpoints Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Renders the single-page web interface |
| `/upload` | `POST` | Accepts file payload (`FormData`), runs OCR & regex, returns JSON |
| `/download/txt` | `POST` | Accepts text string and serves `extracted_invoice_text.txt` attachment |
| `/download/json` | `POST` | Accepts field dictionary and serves `parsed_invoice_details.json` attachment |

---

## 🔧 Troubleshooting

| Issue / Error | Cause | Solution |
| :--- | :--- | :--- |
| `PDFInfoNotInstalledError` | Poppler is not installed or not found in PATH for PDF conversion. | Install Poppler binaries for Windows/Linux and add its `bin/` folder to system PATH, or test with JPG/PNG images. |
| Fields show `"Not Found"` | OCR text did not match standard regex patterns. | Inspect the complete OCR text in the textarea below to see what text Tesseract recognized. Higher resolution images yield better results. |
| `413 Request Entity Too Large` | Uploaded file exceeds 16MB limit. | Upload a smaller image or compressed PDF file. |

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.
