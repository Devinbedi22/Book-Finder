const BASE_URL = window.location.origin;
let token = localStorage.getItem('token');

 
function showMessage(msg, type = 'success') {
  const messageBar = document.getElementById('message-bar');
  if (!messageBar) return;
  messageBar.textContent = msg;
  messageBar.className = `message-bar ${type}`;
  messageBar.style.opacity = 1;
  setTimeout(() => (messageBar.style.opacity = 0), 3000);
}

 
const sections = {
  home: document.getElementById('home-section'),
  list: document.getElementById('list-section'),
  search: document.getElementById('search-section'),
  login: document.getElementById('login-section'),
  signup: document.getElementById('signup-section'),
};

const navMap = {
  'nav-home': 'home',
  'nav-list': 'list',
  'nav-search-api': 'search',
  'nav-login': 'login',
  'nav-signup': 'signup',
};

function toggleNav() {
  document.querySelector('.nav-menu').classList.toggle('responsive');
}

function showSection(sectionKey) {
  Object.entries(sections).forEach(([key, el]) => {
    el.style.display = key === sectionKey ? 'block' : 'none';
  });
  Object.entries(navMap).forEach(([navId, key]) => {
    const navBtn = document.getElementById(navId);
    if (navBtn) navBtn.classList.toggle('active', key === sectionKey);
  });
}

Object.entries(navMap).forEach(([navId, sec]) => {
  const btn = document.getElementById(navId);
  if (btn) {
    btn.onclick = () => {
      const needsLogin = (sec === 'list' || sec === 'search');
      if (needsLogin && !token) {
        showMessage('Please login first!', 'error');
        return;
      }
      showSection(sec);
      if (sec === 'list') fetchBooks();
    };
  }
});

 
document.getElementById('signupBtn').onclick = async () => {
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  if (!username || !email || !password) return showMessage('Fill all fields!', 'error');

  try {
    const res = await fetch(`${BASE_URL}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      showMessage(data.message || 'Signup successful!');
      showSection('login');
    } else {
      showMessage(data.message || 'Signup failed', 'error');
    }
  } catch (e) {
    console.error(e);
    showMessage('Signup failed', 'error');
  }
};
 
document.getElementById('signup-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('signupBtn').click();
});

 
document.getElementById('loginBtn').onclick = async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showMessage('Enter email & password!', 'error');

  try {
    const res = await fetch(`${BASE_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      localStorage.setItem('token', token);
      showMessage('Logged in successfully!');
      updateNavbar();
      showSection('home');
      fetchBooks();
    } else {
      showMessage(data.message || 'Login failed', 'error');
    }
  } catch (e) {
    console.error(e);
    showMessage('Login error', 'error');
  }
};

 
document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

 
document.getElementById('logoutBtn').onclick = () => {
  token = null;
  localStorage.removeItem('token');
  updateNavbar();
  showMessage('Logged out!');
  showSection('login');
};

 
async function fetchBooks() {
  if (!token) return;
  try {
    const res = await fetch(`${BASE_URL}/api/books`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Unauthorized or error fetching books');
    const books = await res.json();
    const ul = document.getElementById('book-list');
    ul.innerHTML = '';

    (books || []).forEach((b) => {
      const authorName = Array.isArray(b.authors) && b.authors.length ? b.authors.join(', ') : 'Unknown author';
      const thumb = b.thumbnail || 'https://via.placeholder.com/128x195';
      const infoLink = b.infoLink || '#';
      const li = document.createElement('li');
      li.classList.add('book-item');
      li.innerHTML = `
        <div class="book-card-inline">
          <img src="${thumb}" alt="cover" class="book-thumb-small">
          <div>
            <a href="${infoLink}" target="_blank"><strong>${b.title}</strong></a><br>
            <small>by ${authorName}</small>
          </div>
          <div class="delete-wrapper">
            <button class="modern-delete-btn" data-id="${b._id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>`;
      ul.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    showMessage('Failed to load books', 'error');
  }
}
 
document.getElementById('book-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const id = btn.dataset.id;
  if (btn.classList.contains('modern-delete-btn')) {
    const wrapper = btn.closest('.delete-wrapper');
    wrapper.innerHTML = `
      <span class="confirm-text">Confirm delete?</span>
      <button class="confirm-btn confirm-yes" data-id="${id}">Yes</button>
      <button class="confirm-btn confirm-no">No</button>
    `;
  } else if (btn.classList.contains('confirm-yes')) {
    try {
      const res = await fetch(`${BASE_URL}/api/books/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showMessage('Book deleted');
        fetchBooks();
      } else {
        const data = await res.json();
        showMessage(data.error || 'Delete failed', 'error');
      }
    } catch (e) {
      console.error(e);
      showMessage('Error deleting book', 'error');
    }
  } else if (btn.classList.contains('confirm-no')) {
    fetchBooks(); 
  }
});
 
document.getElementById('search-button').onclick = async () => {
  const q = document.getElementById('search-query').value.trim();
  const filter = document.getElementById('filter-type')?.value || '';
  const printType = document.getElementById('print-type')?.value || '';
  const orderBy = document.getElementById('order-by')?.value || '';
  if (!q) return showMessage('Enter search term', 'error');

  const params = new URLSearchParams({ q });
  if (filter) params.append('filter', filter);
  if (printType) params.append('printType', printType);
  if (orderBy) params.append('orderBy', orderBy);

  try {
    const res = await fetch(`${BASE_URL}/api/search?${params.toString()}`);
    const data = await res.json();
    const container = document.getElementById('search-results');
    container.innerHTML = '';

    (data || []).forEach((item) => {
      const title = item.title || 'No title';
      const authors = item.authors || ['Unknown author'];
      const description = item.description || '';
      const thumbnail = item.thumbnail || 'https://via.placeholder.com/128x195';
      const infoLink = item.infoLink || '#';

      const card = document.createElement('div');
      card.className = 'book-card';
      card.innerHTML = `
        <img src="${thumbnail}" alt="cover" class="book-thumb">
        <div class="book-details">
          <a href="${infoLink}" target="_blank" class="book-title">${title}</a>
          <p class="book-author">by ${authors.join(', ')}</p>
          <button class="save-btn">Save to My Books</button>
        </div>`;

      card.querySelector('.save-btn').onclick = async () => {
        if (!token) return showMessage('Please login to save books', 'error');
        try {
          const res = await fetch(`${BASE_URL}/api/books`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ title, authors, description, thumbnail, infoLink }),
          });
          const saved = await res.json();
          showMessage(res.ok ? 'Book saved!' : saved.message || 'Error saving', res.ok ? 'success' : 'error');
        } catch (err) {
          console.error(err);
          showMessage('Error saving book', 'error');
        }
      };
      container.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    showMessage('Search failed', 'error');
  }
};
 
function initCarousel() {
  new Splide('#book-carousel', {
    perPage: 4,
    gap: '1rem',
    type: 'loop',
    autoplay: true,
    arrows: true,
    pagination: false,
    breakpoints: {
      768: { perPage: 1 },
      1024: { perPage: 2 },
    },
  }).mount();
  loadTrending();
}

async function loadTrending() {
  try {
    const res = await fetch('https://www.googleapis.com/books/v1/volumes?q=trending&maxResults=6');
    const data = await res.json();
    const list = document.getElementById('carousel-list');
    list.innerHTML = '';

    (data.items || []).forEach((item) => {
      const info = item.volumeInfo;
      const title = info.title || 'Untitled';
      const thumbnail = info.imageLinks?.thumbnail || 'https://via.placeholder.com/128x195';
      const infoLink = info.infoLink || '#';

      const li = document.createElement('li');
      li.className = 'splide__slide';
      li.innerHTML = `
        <div class="book-card">
          <img src="${thumbnail}" alt="${title}">
          <a href="${infoLink}" target="_blank" class="trending-title">${title}</a>
        </div>`;
      list.appendChild(li);
    });
  } catch (e) {
    console.error('Trending load error', e);
  }
}
 
function updateNavbar() {
  const isLoggedIn = !!localStorage.getItem('token');
  document.getElementById('nav-login').style.display = isLoggedIn ? 'none' : 'inline-block';
  document.getElementById('nav-signup').style.display = isLoggedIn ? 'none' : 'inline-block';
  document.getElementById('logoutBtn').style.display = isLoggedIn ? 'inline-block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  initCarousel();
  updateNavbar();
  if (token) fetchBooks();
  showSection(token ? 'home' : 'login');
});
