
const DB_NAME = "DocuVaultDB";
const STORE_NAME = "documents";

let db;
let documents = [];
let previewURL = null;

const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const message = document.getElementById("message");

// Initialize IndexedDB
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, {
                    keyPath: "id"
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Database transaction helper
function storeTransaction(mode, callback) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);

        let request;

        try {
            request = callback(store);
        } catch (error) {
            reject(error);
            return;
        }

        transaction.oncomplete = () => resolve(request?.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

// Load all documents
async function loadDocuments() {
    documents = await storeTransaction(
        "readonly",
        store => store.getAll()
    );

    renderDocuments();
}

// Upload document
form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const file = fileInput.files[0];

    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
        showMessage("File size must be below 20 MB.", true);
        return;
    }

    const allowedExtensions = [
        "pdf", "png", "jpg", "jpeg",
        "webp", "txt", "doc", "docx"
    ];

    const extension = file.name.split(".").pop().toLowerCase();

    if (!allowedExtensions.includes(extension)) {
        showMessage("This file format is not supported.", true);
        return;
    }

    const uploadBtn = document.getElementById("uploadBtn");
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";

    try {
        const documentData = {
            id: crypto.randomUUID(),
            name: document.getElementById("docName").value.trim()
                || file.name,
            fileName: file.name,
            category: document.getElementById("category").value,
            type: file.type,
            size: file.size,
            date: new Date().toISOString(),
            file: file
        };

        await storeTransaction("readwrite", store =>
            store.add(documentData)
        );

        form.reset();
        showMessage("Document uploaded successfully!");
        await loadDocuments();

    } catch (error) {
        console.error(error);
        showMessage("Upload failed. Please try again.", true);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Upload Document";
    }
});

// Display message
function showMessage(text, isError = false) {
    message.textContent = text;
    message.className = isError ? "error" : "success";
}

// Format file size
function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// Get document icon
function getIcon(name) {
    const ext = name.split(".").pop().toLowerCase();

    if (ext === "pdf") return "📕";
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "🖼️";
    if (["doc", "docx"].includes(ext)) return "📘";
    if (ext === "txt") return "📝";

    return "📄";
}

// Create a safe text element
function createText(tag, className, content) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = content;
    return element;
}

// Render documents
function renderDocuments() {
    const list = document.getElementById("documentList");
    list.replaceChildren();

    const search = document.getElementById("searchInput")
        .value.toLowerCase();

    const category = document.getElementById("filterCategory").value;

    const filtered = documents.filter(doc => {
        const matchesSearch =
            doc.name.toLowerCase().includes(search) ||
            doc.fileName.toLowerCase().includes(search);

        const matchesCategory =
            category === "All" || doc.category === category;

        return matchesSearch && matchesCategory;
    });

    document.getElementById("documentCount").textContent =
        filtered.length + " documents";

    if (filtered.length === 0) {
        list.appendChild(createText(
            "p",
            "empty",
            "No documents found. Upload your first document!"
        ));
    }

    filtered.forEach(doc => {
        const card = document.createElement("div");
        card.className = "doc-card";

        const top = document.createElement("div");
        top.className = "doc-top";

        top.appendChild(createText("span", "doc-icon", getIcon(doc.fileName)));

        const info = document.createElement("div");
        info.className = "doc-info";

        info.appendChild(createText("h3", "", doc.name));
        info.appendChild(createText(
            "p",
            "",
            `${formatSize(doc.size)} • ${new Date(doc.date).toLocaleDateString()}`
        ));

        top.appendChild(info);

        const tag = createText("span", "category-tag", doc.category);

        const actions = document.createElement("div");
        actions.className = "doc-actions";

        const previewBtn = document.createElement("button");
        previewBtn.textContent = "Preview";
        previewBtn.addEventListener("click", () => previewDocument(doc));

        const downloadBtn = document.createElement("button");
        downloadBtn.textContent = "Download";
        downloadBtn.addEventListener("click", () => downloadDocument(doc));

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "delete-btn";
        deleteBtn.addEventListener("click", () => deleteDocument(doc.id));

        actions.append(previewBtn, downloadBtn, deleteBtn);
        card.append(top, tag, actions);
        list.appendChild(card);
    });

    updateStats();
}

// Update dashboard
function updateStats() {
    document.getElementById("totalDocs").textContent =
        documents.length;

    document.getElementById("pdfDocs").textContent =
        documents.filter(doc =>
            doc.fileName.toLowerCase().endsWith(".pdf")
        ).length;

    document.getElementById("imageDocs").textContent =
        documents.filter(doc =>
            /\.(jpg|jpeg|png|webp)$/i.test(doc.fileName)
        ).length;
}

// Preview document
function previewDocument(doc) {
    const extension = doc.fileName.split(".").pop().toLowerCase();

    const supported = ["pdf", "png", "jpg", "jpeg", "webp", "txt"];

    if (!supported.includes(extension)) {
        alert("Preview is unavailable for this file type. Please download it.");
        return;
    }

    closePreview();

    previewURL = URL.createObjectURL(doc.file);

    const frame = document.getElementById("previewFrame");

    document.getElementById("previewTitle").textContent = doc.name;
    frame.src = previewURL;

    document.getElementById("previewModal").style.display = "flex";
}

// Close preview
function closePreview() {
    document.getElementById("previewFrame").removeAttribute("src");
    document.getElementById("previewModal").style.display = "none";

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
        previewURL = null;
    }
}

document.getElementById("closePreview")
    .addEventListener("click", closePreview);

document.getElementById("previewModal")
    .addEventListener("click", function (e) {
        if (e.target === this) closePreview();
    });

// Download document
function downloadDocument(doc) {
    const url = URL.createObjectURL(doc.file);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = doc.fileName;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Delete document
async function deleteDocument(id) {
    if (!confirm("Are you sure you want to delete this document?")) {
        return;
    }

    try {
        await storeTransaction("readwrite", store => store.delete(id));

        showMessage("Document deleted successfully!");
        await loadDocuments();

    } catch (error) {
        console.error(error);
        showMessage("Could not delete the document.", true);
    }
}

// Search
document.getElementById("searchInput")
    .addEventListener("input", renderDocuments);

// Category filter
document.getElementById("filterCategory")
    .addEventListener("change", renderDocuments);

// Start application
async function init() {
    try {
        db = await openDatabase();
        await loadDocuments();
    } catch (error) {
        console.error(error);
        showMessage("Unable to open document storage. Please use a modern browser.", true);
    }
}

init();
