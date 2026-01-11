const saveBtn = document.getElementById("save");
const list = document.getElementById("list");
const searchInput = document.getElementById("search");
const tagFilter = document.getElementById("tagFilter");
const pagination = document.getElementById("pagination");

const PAGE_SIZE = 5;
let currentPage = 1;
let bookmarks = [];

/* =====================
   INIT
===================== */
chrome.storage.local.get(["bookmarks"], (res) => {
  bookmarks = res.bookmarks || [];
  renderTagFilter();
  render();
});

/* =====================
   SAVE BOOKMARK
===================== */
saveBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    const note = document.getElementById("note").value.trim();
    const tags = document
      .getElementById("tags")
      .value.split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const item = {
      id: Date.now(),
      title: tab.title,
      url: tab.url,
      note,
      tags,
      createdAt: Date.now(),
    };

    bookmarks.push(item);

    chrome.storage.local.set({ bookmarks }, () => {
      document.getElementById("note").value = "";
      document.getElementById("tags").value = "";
      currentPage = 1;
      renderTagFilter();
      render();
    });
  });
});

/* =====================
   SEARCH & FILTER
===================== */
searchInput.addEventListener("input", () => {
  currentPage = 1;
  render();
});

tagFilter.addEventListener("change", () => {
  currentPage = 1;
  render();
});

/* =====================
   RENDER MAIN
===================== */
function render() {
  let data = [...bookmarks];

  const keyword = searchInput.value.toLowerCase();
  if (keyword) {
    data = data.filter(
      (b) =>
        b.title.toLowerCase().includes(keyword) ||
        b.url.toLowerCase().includes(keyword) ||
        b.note.toLowerCase().includes(keyword) ||
        b.tags.join(",").toLowerCase().includes(keyword)
    );
  }

  const tag = tagFilter.value;
  if (tag) {
    data = data.filter((b) => b.tags.includes(tag));
  }

  renderList(data);
  renderPagination(data.length);
}

/* =====================
   RENDER LIST
===================== */
function renderList(data) {
  list.innerHTML = "";

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = data
    .slice()
    .reverse()
    .slice(start, start + PAGE_SIZE);

  pageData.forEach((b) => {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <div class="wrap_list">
        <strong>${b.title}</strong><br />
        <div class="margin_bar"></div>

        <strong>Link: </strong>
        <a href="#" class="link_url">${b.url}</a><br />
        <div class="margin_bar"></div>

        ${
          b.note
            ? `<div class="note"><strong>Note:</strong> ${b.note}</div>
               <div class="margin_bar"></div>`
            : ""
        }

        <div>
          <strong>Tag: </strong>
          ${b.tags.map((t) => `<span class="tag">${t}</span>`).join("")}
        </div>

        <div class="margin_bar"></div>
        <button class="BtnDelete">Xoá</button>
      </div>
    `;

    div.querySelector("a").onclick = () => {
      chrome.tabs.create({ url: b.url });
    };

    div.querySelector("button").onclick = () => {
      bookmarks = bookmarks.filter((x) => x.id !== b.id);
      chrome.storage.local.set({ bookmarks }, render);
    };

    list.appendChild(div);
  });
}

/* =====================
   PAGINATION
===================== */
function renderPagination(total) {
  pagination.innerHTML = "";

  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.disabled = i === currentPage;

    btn.onclick = () => {
      currentPage = i;
      render();
    };

    pagination.appendChild(btn);
  }
}

/* =====================
   TAG FILTER
===================== */
function renderTagFilter() {
  const tags = new Set();
  bookmarks.forEach((b) => b.tags.forEach((t) => tags.add(t)));

  tagFilter.innerHTML = `<option value="">-- Lọc theo tag --</option>`;
  tags.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    tagFilter.appendChild(opt);
  });
}

document.getElementById("openNote").addEventListener("click", () => {
  chrome.windows.create({
    url: chrome.runtime.getURL("note.html"),
    type: "popup",
    width: 500,
    height: 600,
  });
});

// Chức năng EXPORT (JS)
document.getElementById("exportData").addEventListener("click", () => {
  chrome.storage.local.get(["bookmarks"], (res) => {
    const data = {
      bookmarks: res.bookmarks || [],
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "bookmarks-backup.json";
    a.click();

    URL.revokeObjectURL(url);
  });
});

// Chức năng IMPORT (JS)
document.getElementById("importData").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);

      if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
        alert("File không hợp lệ!");
        return;
      }

      bookmarks = data.bookmarks;

      chrome.storage.local.set({ bookmarks }, () => {
        currentPage = 1;
        renderTagFilter();
        render();
        alert("Import dữ liệu thành công!");
      });
    } catch (err) {
      alert("Không thể đọc file JSON!");
    }
  };

  reader.readAsText(file);
});

// Gợi ý TAG
const tagsInput = document.getElementById("tags");
const tagSuggestions = document.getElementById("tagSuggestions");

function getAllTags() {
  const set = new Set();
  bookmarks.forEach((b) => b.tags.forEach((t) => set.add(t)));
  return [...set];
}

tagsInput.addEventListener("input", () => {
  const value = tagsInput.value;
  const parts = value.split(",");
  const last = parts[parts.length - 1].trim().toLowerCase();

  if (!last) {
    tagSuggestions.style.display = "none";
    return;
  }

  const matches = getAllTags().filter((t) => t.toLowerCase().includes(last));

  tagSuggestions.innerHTML = "";
  matches.forEach((tag) => {
    const div = document.createElement("div");
    div.textContent = tag;

    div.onclick = () => {
      parts[parts.length - 1] = " " + tag;
      tagsInput.value = parts.join(",").replace(/^ /, "");
      tagSuggestions.style.display = "none";
    };

    tagSuggestions.appendChild(div);
  });

  tagSuggestions.style.display = matches.length ? "block" : "none";
});

document.addEventListener("click", (e) => {
  if (!tagSuggestions.contains(e.target) && e.target !== tagsInput) {
    tagSuggestions.style.display = "none";
  }
});

const tags = document
  .getElementById("tags")
  .value.split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const uniqueTags = [...new Set(tags)];
