import os
import re
import json
import shutil
import io
from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image
import pytesseract
from pdf2image import convert_from_path

# ==========================================
# Flask Application Setup & Configuration
# ==========================================

app = Flask(__name__)

# Configure upload folder and allowed extensions
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # Max 16MB file size limit

# Ensure uploads directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Auto-detect Tesseract binary path on Windows if not already in system PATH
def setup_tesseract_path():
    """
    Checks if pytesseract can find tesseract in system PATH.
    If not, checks standard Windows installation paths.
    """
    common_windows_paths = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
        os.path.expanduser(r'~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe')
    ]
    
    # Test if tesseract is accessible in default system PATH
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        # Search common Windows paths
        for path in common_windows_paths:
            if os.path.exists(path):
                pytesseract.pytesseract.tesseract_cmd = path
                return True
        return False

# Initialize Tesseract path check
tesseract_available = setup_tesseract_path()


# ==========================================
# Helper Functions
# ==========================================

def allowed_file(filename):
    """
    Checks if the uploaded file has a permitted extension (.jpg, .jpeg, .png, .pdf).
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def convert_invoice_to_image(file_path):
    """
    Converts uploaded invoice file (image or PDF) into a PIL Image object.
    For PDF files, converts the first page into an image using pdf2image.
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.pdf':
        try:
            # Convert first page of PDF to image
            images = convert_from_path(file_path, first_page=1, last_page=1)
            if not images:
                raise ValueError("Could not extract any pages from PDF.")
            return images[0]
        except Exception as e:
            error_msg = str(e)
            if "poppler" in error_msg.lower() or "pdfinfo" in error_msg.lower():
                raise RuntimeError(
                    "Poppler is required to process PDF files. Please install Poppler or use image formats (JPG/PNG)."
                ) from e
            raise RuntimeError(f"Error processing PDF: {error_msg}") from e
    else:
        # Open standard image files (JPG, JPEG, PNG)
        return Image.open(file_path)


def extract_text_from_image(image):
    """
    Performs OCR on a PIL Image object using pytesseract and returns extracted text.
    """
    try:
        # Use Tesseract to convert image into raw text
        text = pytesseract.image_to_string(image)
        return text
    except pytesseract.TesseractNotFoundError:
        raise RuntimeError(
            "Tesseract OCR is not installed or not found in system PATH. "
            "Please install Tesseract OCR on your system to use this application."
        )
    except Exception as e:
        raise RuntimeError(f"Failed to perform OCR on invoice image: {str(e)}")


def parse_invoice_fields(raw_text):
    """
    Uses Regular Expressions (regex) to parse common invoice fields from extracted OCR text.
    Returns a dictionary of parsed fields. If a field is not found, assigns 'Not Found'.
    """
    fields = {
        "invoice_number": "Not Found",
        "invoice_date": "Not Found",
        "vendor_name": "Not Found",
        "gst_number": "Not Found",
        "tax_amount": "Not Found",
        "total_amount": "Not Found"
    }

    if not raw_text or not raw_text.strip():
        return fields

    # Clean lines for inspection
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    # 1. Invoice Number Patterns
    # Looks for terms like Invoice No, Inv #, Invoice Number, Bill No followed by numbers/letters
    inv_no_pattern = r'(?:invoice|inv|bill)\s*(?:no|num|number|code|#)?[:.\s-]*([A-Za-z0-9/-]{3,25})'
    match_inv = re.search(inv_no_pattern, raw_text, re.IGNORECASE)
    if match_inv:
        fields["invoice_number"] = match_inv.group(1).strip()

    # 2. Invoice Date Patterns
    # Matches common date formats (e.g., DD/MM/YYYY, YYYY-MM-DD, 12 Jan 2024, January 12, 2024)
    date_pattern = r'(?:date|dated|dt)[:.\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s*\d{2,4})'
    match_date = re.search(date_pattern, raw_text, re.IGNORECASE)
    if match_date:
        fields["invoice_date"] = match_date.group(1).strip()
    else:
        # Fallback date search if keyword 'date' isn't directly preceding
        standalone_date = re.search(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b', raw_text)
        if standalone_date:
            fields["invoice_date"] = standalone_date.group(1).strip()

    # 3. GST Number Patterns
    # Standard Indian GSTIN format (15 characters: e.g., 22AAAAA0000A1Z5) or general GST regex
    gst_pattern = r'(?:gst(?:in)?|gstin/uin)[:.\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}|[0-9A-Z]{15})'
    match_gst = re.search(gst_pattern, raw_text, re.IGNORECASE)
    if match_gst:
        fields["gst_number"] = match_gst.group(1).strip()
    else:
        # Direct regex search for 15-char GSTIN string
        direct_gst = re.search(r'\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b', raw_text)
        if direct_gst:
            fields["gst_number"] = direct_gst.group(0).strip()

    # 4. Total Amount Patterns
    # Looks for phrases like Total Amount, Grand Total, Net Payable, Total due followed by currency symbol and values
    total_pattern = r'(?:grand\s*total|total\s*amount|net\s*payable|amount\s*due|total\s*due|total)[:.\s]*[₹$€£]?\s*([\d,]+\.\d{2}|[\d,]+)'
    match_total = re.search(total_pattern, raw_text, re.IGNORECASE)
    if match_total:
        fields["total_amount"] = match_total.group(1).strip()

    # 5. Tax Amount Patterns
    # Looks for terms like Tax, VAT, GST Amount, CGST, SGST, IGST
    tax_pattern = r'(?:tax\s*amount|total\s*tax|vat|gst\s*amount|cgst|sgst|igst)[:.\s]*[₹$€£]?\s*([\d,]+\.\d{2}|[\d,]+)'
    match_tax = re.search(tax_pattern, raw_text, re.IGNORECASE)
    if match_tax:
        fields["tax_amount"] = match_tax.group(1).strip()

    # 6. Vendor Name Heuristic
    # Look for keywords like Vendor:, From:, Company: or fallback to top non-empty text lines
    vendor_pattern = r'(?:vendor|seller|from|supplier|company)[:.\s]*([A-Za-z0-9\s&.,-]{2,40})'
    match_vendor = re.search(vendor_pattern, raw_text, re.IGNORECASE)
    if match_vendor:
        fields["vendor_name"] = match_vendor.group(1).strip()
    elif lines:
        # Often the vendor name is at the top line of the invoice header
        first_line = lines[0]
        # Ignore if top line is just "INVOICE"
        if len(first_line) > 2 and not re.match(r'^(invoice|tax invoice|bill)$', first_line, re.IGNORECASE):
            fields["vendor_name"] = first_line
        elif len(lines) > 1:
            fields["vendor_name"] = lines[1]

    return fields


# ==========================================
# Routes & Controllers
# ==========================================

@app.route('/')
def index():
    """
    Renders the single-page HTML interface.
    """
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Endpoint to receive file upload via Ajax/Fetch.
    Saves file temporarily, converts to image if PDF, executes OCR, parses fields,
    removes temporary file, and returns JSON output.
    """
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file parameter found in request."}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected for uploading."}), 400

    if not allowed_file(file.filename):
        return jsonify({
            "success": False, 
            "error": f"Invalid file type '{file.filename}'. Allowed types are JPG, JPEG, PNG, and PDF."
        }), 400

    temp_filepath = None
    try:
        # Save file temporarily
        filename = file.filename
        temp_filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(temp_filepath)

        # Convert file (PDF/Image) to PIL Image
        image = convert_invoice_to_image(temp_filepath)

        # Run pytesseract OCR
        raw_text = extract_text_from_image(image)

        # Parse key invoice fields using regular expressions
        parsed_fields = parse_invoice_fields(raw_text)

        return jsonify({
            "success": True,
            "filename": filename,
            "parsed_fields": parsed_fields,
            "raw_text": raw_text
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        # Clean up temporary uploaded file to save disk space
        if temp_filepath and os.path.exists(temp_filepath):
            try:
                os.remove(temp_filepath)
            except Exception:
                pass


@app.route('/download/txt', methods=['POST'])
def download_txt():
    """
    Generates a downloadable .txt file containing the complete raw OCR text.
    """
    data = request.get_json(silent=True) or request.form
    text_content = data.get('text', '')

    # Create an in-memory text stream for file download
    buffer = io.BytesIO()
    buffer.write(text_content.encode('utf-8'))
    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name='extracted_invoice_text.txt',
        mimetype='text/plain'
    )


@app.route('/download/json', methods=['POST'])
def download_json():
    """
    Generates a downloadable .json file containing the parsed invoice key fields.
    """
    data = request.get_json(silent=True) or request.form
    fields = data.get('fields', {})

    # Create an in-memory JSON stream for file download
    buffer = io.BytesIO()
    json_bytes = json.dumps(fields, indent=4).encode('utf-8')
    buffer.write(json_bytes)
    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name='parsed_invoice_details.json',
        mimetype='application/json'
    )


# ==========================================
# Main Execution Entry Point
# ==========================================

if __name__ == '__main__':
    print("Starting Auto Invoice Reader Flask Server...")
    print("Open http://127.0.0.1:5000 in your web browser.")
    app.run(debug=True, port=5000)
