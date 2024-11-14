posts: {
  container: null,
  loadMoreButton: null,
  currentPage: 1,
  isLoading: false,
  isGridView: localStorage.getItem('gridView') !== 'false',
  authorImages: {},
  loadedPosts: new Set(),

  init: function() {
    this.container = document.getElementById('articles-grid');
    this.loadMoreButton = document.getElementById('load-more-button');
    
    if (this.container && this.loadMoreButton) {
      this.loadMoreButton.addEventListener('click', this.loadMore.bind(this));
      this.setupViewToggle();
      this.applyCurrentView();
      this.setupIntersectionObserver();
    }
  },

  setupIntersectionObserver: function() {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isLoading) {
          this.loadMore();
        }
      });
    }, options);

    observer.observe(this.loadMoreButton);
  },

  loadMore: async function() {
    if (this.isLoading) return;
    this.isLoading = true;
    
    this.showLoadingIndicator();

    try {
      const data = await this.fetchPosts();
      
      if (!data || !data.feed || !data.feed.entry || data.feed.entry.length === 0) {
        this.showNoMorePosts();
        return;
      }

      const posts = data.feed.entry.filter(post => !this.loadedPosts.has(post.id.$t));

      this.renderPosts(posts);

      this.currentPage++;
      this.isLoading = false;
      this.hideLoadingIndicator();
      this.applyCurrentView();
    } catch (error) {
      this.showError();
    }
  },

  showLoadingIndicator: function() {
    this.loadMoreButton.innerHTML = EnhancedBlog.util.translate('loading') + " <span class='mask spin'></span>";
    this.loadMoreButton.disabled = true;
  },

  hideLoadingIndicator: function() {
    this.loadMoreButton.innerHTML = EnhancedBlog.util.translate('loadMore');
    this.loadMoreButton.disabled = false;
  },

  fetchPosts: async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    const labelName = window.location.pathname.split('/').pop();
    const isSearchPage = searchQuery !== null;
    const isLabelPage = window.location.pathname.includes('/label/');

    let apiUrl = `${document.location.origin}/feeds/posts/summary?alt=json&orderby=published&start-index=${this.currentPage * EnhancedBlog.config.postsPerPage + 1}&max-results=${EnhancedBlog.config.postsPerPage}`;
    
    if (isSearchPage) {
      apiUrl += `&q=${encodeURIComponent(searchQuery)}`;
    } else if (isLabelPage) {
      apiUrl += `/-/${encodeURIComponent(labelName)}`;
    }

    return await EnhancedBlog.util.fetchJSON(apiUrl);
  },

  renderPosts: function(posts) {
    const fragment = document.createDocumentFragment();
    posts.forEach(post => {
      const postElement = this.createPostElement(post);
      if (postElement) {
        fragment.appendChild(postElement);
        this.loadedPosts.add(post.id.$t);
      }
    });
    this.container.appendChild(fragment);
  },

  createPostElement: function(post) {
    if (!post) return null;

    const postElement = document.createElement('div');
    postElement.className = 'rounded-lg dark:bg-neutral-800';
    
    const title = post.title && post.title.$t ? post.title.$t : 'No Title';
    const url = post.link ? post.link.find(link => link.rel === 'alternate').href : '#';
    const image = post.media$thumbnail ? post.media$thumbnail.url.replace(/\/s[0-9]+(\-c)?\//, '/s640/') : 'https://via.placeholder.com/640x360';
    
    let excerpt = 'No excerpt available';
    if (post.summary && post.summary.$t) {
      excerpt = post.summary.$t;
    } else if (post.content && post.content.$t) {
      const div = document.createElement('div');
      div.innerHTML = post.content.$t;
      excerpt = div.textContent || div.innerText || '';
    }
    excerpt = excerpt.substring(0, 100).trim() + (excerpt.length > 100 ? '...' : '');

    const author = post.author && post.author[0] && post.author[0].name ? post.author[0].name.$t : 'Unknown Author';
    
    const dateIso = post.published && post.published.$t ? post.published.$t : new Date().toISOString();
    const dateFormatted = EnhancedBlog.util.formatDate(dateIso);

    // Get the author's image
    let authorImage = this.getAuthorImage(post);

    postElement.innerHTML = `
      <div class="w-full h-60 rounded-t-lg">
        <a aria-label="Image" href="${url}">
          <img alt="${title}" class="object-cover w-full h-full rounded-t-lg nice-effect" src="${image}">
        </a>
      </div>
      <div class="p-4 dark:bg-neutral-800">
        <h3 class="text-lg font-semibold mb-5">
          <a class="link-title" href="${url}">${title}</a>
        </h3>
        <p class="text-sm text-neutral-600 dark:text-neutral-300">${excerpt}</p>
        <div class="shrink-0 group block mt-4">
          <div class="flex items-center">
            <img alt="Avatar" class="inline-block shrink-0 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full" src="${authorImage}">
            <div class="rtl:mr-3 ltr:ml-3">
              <h3 class="font-semibold text-neutral-800 dark:text-neutral-300 text-sm sm:text-base">
                ${author}
              </h3>
              <time datetime="${dateIso}" class="text-xs sm:text-sm text-neutral-500">
                ${dateFormatted}
              </time>
            </div>
          </div>
        </div>
      </div>
    `;

    return postElement;
  },

  getAuthorImage: function(post) {
    const authorId = post.author[0].gd$image.src;
    if (this.authorImages[authorId]) {
      return this.authorImages[authorId];
    }

    let authorImage = 'https://lh3.googleusercontent.com/a/default-user';
    if (!authorId.includes('g/blank.gif') && !authorId.includes('g/b16-rounded.gif')) {
      authorImage = authorId.replace(/\/s\d+-c\//, '/s80-c/');
    }

    this.authorImages[authorId] = authorImage;
    return authorImage;
  },

  showNoMorePosts: function() {
    this.loadMoreButton.textContent = EnhancedBlog.util.translate('noMorePosts');
    this.loadMoreButton.disabled = true;
    this.loadMoreButton.className = 'py-3 px-6 text-sm rounded-lg border border-primary text-primary cursor-not-allowed font-semibold text-center shadow-xs transition-all duration-500 bg-gray-300 text-gray-600';
    this.isLoading = false;
  },

  showError: function() {
    this.loadMoreButton.textContent = EnhancedBlog.util.translate('errorOccurred');
    this.loadMoreButton.classList.add('err');
    
    setTimeout(() => {
      this.loadMoreButton.textContent = EnhancedBlog.util.translate('loadMore');
      this.loadMoreButton.classList.remove('err');
      this.loadMoreButton.disabled = false;
    }, 1500);
  },

  setupViewToggle: function() {
    const gridIcon = document.getElementById('grid-icon');
    const listIcon = document.getElementById('list-icon');

    if (gridIcon && listIcon) {
      gridIcon.addEventListener('click', () => this.toggleView(true));
      listIcon.addEventListener('click', () => this.toggleView(false));
    }
  },

  toggleView: function(gridView) {
    this.isGridView = gridView;
    localStorage.setItem('gridView', gridView);
    this.applyCurrentView();
  },

  applyCurrentView: function() {
    const gridIcon = document.getElementById('grid-icon');
    const listIcon = document.getElementById('list-icon');

    gridIcon.classList.toggle('active', this.isGridView);
    listIcon.classList.toggle('active', !this.isGridView);
    this.container.className = `grid gap-6 ${this.isGridView ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`;

    this.container.querySelectorAll('.rounded-lg.dark\\:bg-neutral-800').forEach((card) => {
      if (this.isGridView) {
        card.className = 'rounded-lg dark:bg-neutral-800';
        card.firstElementChild.className = 'w-full h-60 rounded-t-lg';
      } else {
        card.className = 'rounded-lg flex dark:bg-neutral-800';
        card.firstElementChild.className = 'w-1/3 md:h-48 h-60 rounded-r-lg';
      }
      card.lastElementChild.className = `p-4 dark:bg-neutral-800 ${this.isGridView ? '' : 'flex-1'}`;
    });
  }
},
