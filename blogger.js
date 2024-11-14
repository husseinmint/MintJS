// Enhanced Blog JavaScript

(function(window, document) {
'use strict';

const EnhancedBlog = {
  config: {
    postsPerPage: 7,
    defaultLanguage: 'ar',
    supportedLanguages: ['en', 'ar'],
    translations: {
      en: {
        loadMore: 'Load More',
        loading: 'Loading...',
        noMorePosts: 'No more posts',
        copyLinkSuccess: 'Article link copied',
        readingTime: '{} min read',
        gridView: 'Grid View',
        listView: 'List View',
        relatedPosts: 'Suggested for you',
        errorOccurred: 'An error occurred. Please try again.'
      },
      ar: {
        loadMore: 'تحميل المزيد',
        loading: 'جاري التحميل...',
        noMorePosts: 'لا توجد مزيد من المقالات',
        copyLinkSuccess: 'تم نسخ رابط المقال',
        readingTime: '{} دقائق للقراءة',
        gridView: 'عرض شبكي',
        listView: 'عرض القائمة',
        relatedPosts: 'مقترح لك',
        errorOccurred: 'حدث خطأ. حاول مرة أخرى.'
      }
    }
  },

  util: {
    isRTL: function() {
      return document.documentElement.dir === 'rtl';
    },
    getLanguage: function() {
      const htmlLang = document.documentElement.lang.split('-')[0];
      return EnhancedBlog.config.supportedLanguages.includes(htmlLang) ? htmlLang : EnhancedBlog.config.defaultLanguage;
    },
    translate: function(key, count) {
      const lang = this.getLanguage();
      let text = EnhancedBlog.config.translations[lang][key] || key;
      return count !== undefined ? text.replace('{}', count) : text;
    },
    fetchJSON: async function(url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    formatDate: function(dateString) {
      const date = new Date(dateString);
      const lang = this.getLanguage();
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', options);
    },
    shuffleArray: function(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
  },

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

  comments: {
    init: function() {
      const commentForm = document.getElementById('comment-form');
      const formScript = document.getElementById('form-script');
      const formRestore = document.getElementById('form-restore');
      const replyButtons = document.querySelectorAll('[data-parent-id]');

      if (commentForm) {
        this.setupCommentForm(commentForm, formScript, formRestore, replyButtons);
      }

      this.setupDisqus();
    },

    setupCommentForm: function(commentForm, formScript, formRestore, replyButtons) {
      const originalForm = commentForm.innerHTML;
      let activeReplyButton;

      const replyForm = document.createElement('div');
      replyForm.id = 'reply-form';

      replyButtons.forEach(button => {
        button.onclick = () => {
          const parentId = button.dataset.parentId;
          const repliesContainer = document.querySelector(`#c${parentId} .comments-replies`);

          if (activeReplyButton === button) return;

          if (document.getElementById('reply-form')) {
            document.getElementById('reply-form').parentElement.classList.remove('has-reply-form');
            document.getElementById('reply-form').remove();
          } else {
            commentForm.innerHTML = '';
            formRestore.classList.add('is-replying');
          }

          if (activeReplyButton) {
            activeReplyButton.classList.remove('is-active');
          }

          const originalSrc = commentForm.innerHTML.match(/<iframe[^>]*\s+src="([^"]*)"/i)[1];
          const newSrc = `${originalSrc}&parentID=${parentId}`;
          const newForm = originalForm.replace(originalSrc, newSrc);

          button.classList.add('is-active');
          activeReplyButton = button;

          replyForm.innerHTML = newForm;
          repliesContainer.classList.add('has-reply-form');
          repliesContainer.insertAdjacentElement('afterbegin', replyForm);
        };
      });

      if (formRestore) {
        formRestore.onclick = () => {
          if (activeReplyButton) {
            formRestore.classList.remove('is-replying');
            commentForm.innerHTML = originalForm;
            activeReplyButton.classList.remove('is-active');
            activeReplyButton = null;
            document.getElementById('reply-form').parentElement.classList.remove('has-reply-form');
            document.getElementById('reply-form').remove();
          }
        };
      }

      if (formScript) {
        const scriptSrc = formScript.value.replace(/<script.*?src='(.*?)'.*?><\/script>/, "$1");
        formScript.remove();
        this.loadScript(scriptSrc).then(() => {
          BLOG_CMT_createIframe('https://www.blogger.com/rpc_relay.html');
        }).catch(error => console.error(error));
      }
    },

    setupDisqus: function() {
      const disqusThread = document.getElementById('disqus_thread');
      const disqusButton = document.getElementById('disqus_btn');
      const disqusCommentCount = document.querySelector('.disqus-comment-count');

      if (disqusCommentCount) {
        const { shortname } = disqusCommentCount.dataset;
        this.loadScript(`https://${shortname}.disqus.com/count.js`);
      }

      if (disqusThread) {
        if (disqusButton) {
          disqusButton.onclick = () => {
            this.loadDisqus(disqusThread);
            disqusButton.remove();
          };
        } else {
          this.loadDisqusWhenVisible(disqusThread);
        }
      }
    },

    loadDisqus: function(disqusThread) {
      const { shortname, postUrl, postId } = disqusThread.dataset;
      window.disqus_config = function() {
        this.page.url = postUrl;
        this.page.identifier = postId;
      };
      const script = document.createElement('script');
      script.src = `https://${shortname}.disqus.com/embed.js`;
      script.setAttribute('data-timestamp', +new Date());
      document.head.appendChild(script);
    },

    loadDisqusWhenVisible: function(disqusThread) {
      const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadDisqus(disqusThread);
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '200px' });

      observer.observe(disqusThread);
    },

    loadScript: function(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }
  },

  relatedPosts: {
    container: null,

    init: function() {
      this.container = document.getElementById('enhancedblog-related-posts');
      if (this.container && this.container.getAttribute('data-bjs') === 'related') {
        this.loadRelatedPosts();
      }
    },

    loadRelatedPosts: async function() {
      try {
        const postId = this.container.getAttribute('data-id');
        const tagsAttr = this.container.getAttribute('data-tags');
        const tags = tagsAttr ? JSON.parse(tagsAttr.replace(/&quot;/g, '"')) : [];
        const maxResults = parseInt(this.container.getAttribute('data-max-results'), 10) || 15;
        const length = parseInt(this.container.getAttribute('data-length'), 10) || 3;

        if (tags.length === 0) {
          this.showPlaceholder();
          return;
        }

        const data = await this.fetchRelatedPosts(tags, maxResults);
        const filteredPosts = this.filterAndShufflePosts(data.feed.entry, postId, length);
        this.renderRelatedPosts(filteredPosts);
      } catch (error) {
        this.showErrorMessage();
      }
    },

    fetchRelatedPosts: async function(tags, maxResults) {
      const query = tags.map(tag => `label:"${tag}"`).join('|');
      const apiUrl = `${document.location.origin}/feeds/posts/default?alt=json&orderby=published&max-results=${maxResults}&q=${encodeURIComponent(query)}`;
      return await EnhancedBlog.util.fetchJSON(apiUrl);
    },

    filterAndShufflePosts: function(posts, currentPostId, length) {
      if (!posts) {
        return [];
      }
      const filteredPosts = posts.filter(post => post.id.$t !== currentPostId);
      return EnhancedBlog.util.shuffleArray(filteredPosts).slice(0, length);
    },

    renderRelatedPosts: function(posts) {
      if (!posts || posts.length === 0) {
        this.showPlaceholder();
        return;
      }

      const gridContainer = document.createElement('div');
      gridContainer.className = 'mx-auto mt-3 grid max-w-2xl auto-rows-fr grid-cols-1 gap-4 sm:mt-6 lg:mx-0 lg:max-w-none lg:grid-cols-3';

      posts.forEach(post => {
        const postElement = this.createRelatedPostElement(post);
        gridContainer.appendChild(postElement);
      });

      this.container.innerHTML = '';
      this.container.appendChild(gridContainer);
    },

    createRelatedPostElement: function(post) {
      const title = post.title.$t;
      const url = post.link.find(link => link.rel === 'alternate').href;
      const image = post.media$thumbnail ? post.media$thumbnail.url.replace(/\/s[0-9]+(\-c)?\//, '/s300-c/') : 'https://via.placeholder.com/300x200';
      const author = post.author[0].name.$t;
      const dateIso = post.published.$t;
      const dateFormatted = EnhancedBlog.util.formatDate(dateIso);
      const authorImage = EnhancedBlog.posts.getAuthorImage(post);

      const article = document.createElement('article');
      article.className = 'relative isolate flex flex-col justify-end overflow-hidden rounded-lg bg-gray-900 px-4 pb-4 pt-32 sm:pt-24 lg:pt-32';
      article.innerHTML = `
        <img alt="" class="absolute inset-0 -z-10 h-full w-full object-cover" width="300" height="200" style="aspect-ratio: 300 / 200; object-fit: cover" src="${image}">
        <div class="absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/40"></div>
        <div class="absolute inset-0 -z-10 rounded-lg ring-1 ring-inset ring-gray-900/10"></div>
        <div class="flex flex-wrap items-center gap-y-1 overflow-hidden text-sm leading-6 text-gray-300">
          <time datetime="${dateIso}" class="${EnhancedBlog.util.isRTL() ? 'ml-4' : 'mr-4'}">${dateFormatted}</time>
          <div class="${EnhancedBlog.util.isRTL() ? 'mr-2' : 'ml-2'} flex items-center gap-x-2 text-gray-500">
            <span class="relative flex overflow-hidden rounded-full h-5 w-5 flex-none">
              <img class="aspect-square h-full w-full" alt="${author}" src="${authorImage}">
            </span>
            <span>${author}</span>
          </div>
        </div>
        <h3 class="mt-2 text-base font-semibold leading-6 text-white">
          <a href="${url}">${title}</a>
        </h3>
      `;

      return article;
    },

    showErrorMessage: function() {
      this.container.innerHTML = '<p class="text-red-500">Error loading related posts. Please try again later.</p>';
    },

    showPlaceholder: function() {
      this.container.innerHTML = '<p class="text-gray-500">No related posts found.</p>';
    }
  },

  postUtilities: {
    init: function() {
      this.setupCopyLink();
      this.calculateReadingTime();
    },

    setupCopyLink: function() {
      const copyButton = document.getElementById('copy-link-button');
      if (copyButton) {
        copyButton.addEventListener('click', this.copyPostUrl.bind(this));
      }
    },

    copyPostUrl: function() {
      navigator.clipboard.writeText(window.location.href).then(() => {
        this.showTooltip(EnhancedBlog.util.translate('copyLinkSuccess'));
      }).catch(err => {
        // Error handling without console.log
      });
    },

    showTooltip: function(message) {
      const tooltip = document.getElementById('copy-link-tooltip');
      if (tooltip) {
        tooltip.textContent = message;
        tooltip.classList.remove('opacity-0');
        tooltip.classList.add('opacity-100');

        setTimeout(() => {
          tooltip.classList.remove('opacity-100');
          tooltip.classList.add('opacity-0');
        }, 2000);
      }
    },

    calculateReadingTime: function() {
      const articleContent = document.querySelector('.post-body');
      const readingTimeElement = document.getElementById('reading-time');
      
      if (articleContent && readingTimeElement) {
        const text = articleContent.textContent || articleContent.innerText;
        const wordCount = text.trim().split(/\s+/).length;
        const readingTime = Math.ceil(wordCount / 200);
        
        readingTimeElement.textContent = EnhancedBlog.util.translate('readingTime', readingTime);
      }
    }
  },

  init: function() {
    this.posts.init();
    this.comments.init();
    this.relatedPosts.init();
    this.postUtilities.init();
  }
};

// Initialize EnhancedBlog when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', EnhancedBlog.init.bind(EnhancedBlog));
} else {
  EnhancedBlog.init();
}

// Export EnhancedBlog for use in Blogger templates
window.EnhancedBlog = EnhancedBlog;

})(window, document);
