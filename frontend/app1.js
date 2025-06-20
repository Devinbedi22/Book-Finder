const BASE_URL = '';

function showMessage(msg, type = 'success') {
  let messageBar = document.getElementById('message-bar');
  if (!messageBar) {
    messageBar = document.createElement('div');
    messageBar.id = 'message-bar';
    document.body.appendChild(messageBar);
  }
  messageBar.textContent = msg;
  messageBar.className = `message-bar ${type}`;
  messageBar.style.opacity = 1;
  clearTimeout(messageBar._fadeTimer);
  messageBar._fadeTimer = setTimeout(() => {
    messageBar.style.opacity = 0;
  }, 3000);
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
    btn.onclick = async () => {
      const needsLogin = sec === 'list' || sec === 'search';
      if (needsLogin && !(await isLoggedIn())) {
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
  if (password.length < 6) return showMessage('Password must be at least 6 characters', 'error');

  try {
    const res = await fetch(`${BASE_URL}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, email, password }),
    });

    const data = await res.json();
    if (res.ok) {
      showMessage(data.message || 'Signup successful!');
      updateNavbar();
      showSection('home');
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
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (res.ok) {
      showMessage('Logged in successfully!');
      updateNavbar();
      showSection('home');
      fetchBooks();
    } else {
      showMessage(data.message || 'Invalid credentials', 'error');
    }
  } catch (e) {
    console.error(e);
    showMessage('Login error', 'error');
  }
};

document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

document.getElementById('logoutBtn').onclick = async () => {
  try {
    await fetch(`${BASE_URL}/api/users/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    updateNavbar();
    showMessage('Logged out!');
    showSection('login');
  } catch (e) {
    console.error(e);
    showMessage('Logout failed', 'error');
  }
};

async function fetchBooks() {
  try {
    const res = await fetch(`${BASE_URL}/api/books`, {
      credentials: 'include',
    });

    if (res.status === 401) {
      updateNavbar();
      showMessage('Session expired. Please login again.', 'error');
      showSection('login');
      return;
    }

    const books = await res.json();
    const ul = document.getElementById('book-list');
    ul.innerHTML = '';

    books.forEach((b) => {
      if (!b.id) return;
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
            <button class="modern-delete-btn" data-id="${b.id}">
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
      <button class="confirm-btn yes" data-id="${id}">Yes</button>
      <button class="confirm-btn no">No</button>`;
  } else if (btn.classList.contains('yes')) {
    try {
      const res = await fetch(`${BASE_URL}/api/books/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Book deleted', 'success');
        fetchBooks();
      } else {
        showMessage(data.message || 'Delete failed', 'error');
      }
    } catch (e) {
      console.error(e);
      showMessage('Error deleting book', 'error');
    }
  } else if (btn.classList.contains('no')) {
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
        try {
          const res = await fetch(`${BASE_URL}/api/books`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ title, authors, description, thumbnail, infoLink }),
          });
          const saved = await res.json();
          if (res.ok) {
            showMessage('Book added to your list!', 'success');
          } else {
            showMessage(saved.message || 'Error saving book', 'error');
          }
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
    document.getElementById('carousel-list').innerHTML = '<p>Could not load trending books.</p>';
  }
}

async function isLoggedIn() {
  try {
    const res = await fetch(`${BASE_URL}/api/users/me`, {
      credentials: 'include',
    });
    const data = await res.json();
    return !!data.user;
  } catch {
    return false;
  }
}

async function updateNavbar() {
  const isLogged = await isLoggedIn();
  document.getElementById('nav-login').style.display = isLogged ? 'none' : 'inline-block';
  document.getElementById('nav-signup').style.display = isLogged ? 'none' : 'inline-block';
  document.getElementById('logoutBtn').style.display = isLogged ? 'inline-block' : 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
  initCarousel();
  await updateNavbar();
  if (await isLoggedIn()) {
    fetchBooks();
    showSection('home');
  } else {
    showSection('login');
  }
});
