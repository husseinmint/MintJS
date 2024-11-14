// MintBlogger - Enhanced Blogger JavaScript Library

(function(window, document) {
  'use strict';

  const MintBlogger = {
    config: {
      postsPerPage: 7,
      commentsPerPage: 5,
      relatedPostsCount: 3,
      defaultLanguage: 'ar',
      supportedLanguages: ['en', 'ar'],
      translations: {
        en: {
          loadMore: 'Load More',
          loading: 'Loading...',
          noMorePosts: 'No more posts',
          noMoreComments: 'No more comments',
          copyLinkSuccess: 'Article link copied',
          readingTime: '{} min read',
          gridView: 'Grid View',
          listView: 'List View',
          commentCount: '{} Comments',
          relatedPosts: 'Suggested for you',
          errorOccurred: 'An error occurred. Please try again.'
        },
        ar: {
          loadMore: 'تحميل المزيد',
          loading: 'جاري التحميل...',
          noMorePosts: 'لا توجد مزيد من المقالات',
          noMoreComments: 'لا توجد المزيد من التعليقات',
          copyLinkSuccess: 'تم نسخ رابط المقال',
          readingTime: '{} دقائق للقراءة',
          gridView: 'عرض شبكي',
          listView: 'عرض القائمة',
          commentCount: '{} تعليقات',
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
        return MintBlogger.config.supportedLanguages.includes(htmlLang) ? htmlLang : MintBlogger.config.defaultLanguage;
      },
      translate: function(key, count) {
        const lang = this.getLanguage();
        let text = MintBlogger.config.translations[lang][key] || key;
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
          console.error('Error fetching JSON:', error);
          throw error;
        }
      },
      formatDate: function(dateString) {
        const date = new Date(dateString);
        const lang = this.getLanguage();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', options);
      },
      createElement: function(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        Object.entries(attributes).forEach(([key, value]) => {
          if (key === 'className') {
            element.className = value;
          } else {
            element.setAttribute(key, value);
          }
        });
        children.forEach(child => {
          if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
          } else {
            element.appendChild(child);
          }
        });
        return element;
      }
    },

    posts: {
      container: null,
      loadMoreButton: null,
      currentPage: 1,
      isLoading: false,
      isGridView: localStorage.getItem('gridView') !== 'false',
      authorImages: {},

      init: function() {
        this.container = document.getElementById('articles-grid');
        this.loadMoreButton = document.getElementById('load-more-button');
        
        if (this.container && this.loadMoreButton) {
          this.loadMoreButton.addEventListener('click', this.loadMore.bind(this));
          this.setupViewToggle();
          this.applyCurrentView();
        }
      },

      loadMore: async function() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        const originalButtonText = this.loadMoreButton.textContent;
        this.loadMoreButton.innerHTML = originalButtonText + " <span class='mask spin'></span>";
        this.loadMoreButton.disabled = true;

        try {
          const data = await this.fetchPosts();
          
          if (!data || !data.feed || !data.feed.entry || data.feed.entry.length === 0) {
            this.showNoMorePosts();
            return;
          }

          const posts = data.feed.entry;
          const lastLoadedPostId = this.getLastLoadedPostId();

          // Add skeleton loaders
          for (let i = 0; i < posts.length; i++) {
            this.container.innerHTML += '<div class="skeleton rounded-lg dark:bg-neutral-800 h-96"></div>';
          }

          // Replace skeleton loaders with actual posts
          setTimeout(() => {
            this.container.querySelectorAll('.skeleton').forEach(skeleton => skeleton.remove());
            posts.forEach(post => {
              if (post.id.$t !== lastLoadedPostId) {
                const postElement = this.createPostElement(post);
                if (postElement) {
                  this.container.appendChild(postElement);
                }
              }
            });

            this.currentPage++;
            this.isLoading = false;
            this.loadMoreButton.innerHTML = originalButtonText;
            this.loadMoreButton.disabled = false;
            this.applyCurrentView();
          }, 250);

        } catch (error) {
          this.showError();
        }
      },

      getLastLoadedPostId: function() {
        const posts = this.container.querySelectorAll('.rounded-lg.dark\\:bg-neutral-800');
        return posts.length > 0 ? posts[posts.length - 1].dataset.postId : null;
      },

      fetchPosts: async function() {
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('q');
        const labelName = window.location.pathname.split('/').pop();
        const isSearchPage = searchQuery !== null;
        const isLabelPage = window.location.pathname.includes('/label/');

        let apiUrl = `${document.location.origin}/feeds/posts/summary?alt=json&orderby=published&start-index=${this.currentPage * MintBlogger.config.postsPerPage + 1}&max-results=${MintBlogger.config.postsPerPage}`;
        
        if (isSearchPage) {
          apiUrl += `&q=${encodeURIComponent(searchQuery)}`;
        } else if (isLabelPage) {
          apiUrl += `/-/${encodeURIComponent(labelName)}`;
        }

        return await MintBlogger.util.fetchJSON(apiUrl);
      },

      createPostElement: function(post) {
        if (!post) return null;

        const postElement = document.createElement('div');
        postElement.className = 'rounded-lg dark:bg-neutral-800';
        postElement.dataset.postId = post.id.$t;
        
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
        const dateFormatted = MintBlogger.util.formatDate(dateIso);

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
        this.loadMoreButton.textContent = MintBlogger.util.translate('noMorePosts');
        this.loadMoreButton.disabled = true;
        this.loadMoreButton.className = 'py-3 px-6 text-sm rounded-lg border border-primary text-primary cursor-not-allowed font-semibold text-center shadow-xs transition-all duration-500 bg-gray-300 text-gray-600';
        this.isLoading = false;
      },

      showError: function() {
        this.loadMoreButton.textContent = MintBlogger.util.translate('errorOccurred');
        this.loadMoreButton.classList.add('err');
        
        setTimeout(() => {
          this.loadMoreButton.textContent = MintBlogger.util.translate('loadMore');
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
      container: null,
      loadMoreButton: null,
      currentPage: 1,
      isLoading: false,
      postId: null,

      init: function() {
        this.container = document.getElementById('comments');
        this.loadMoreButton = document.getElementById('load-more-comments');
        this.postId = this.getPostId();
        
        if (this.container && this.loadMoreButton && this.postId) {
          this.loadMoreButton.addEventListener('click', this.loadMore.bind(this));
          this.setupCommentReplies();
        }
      },

      getPostId: function() {
        const postIdMeta = document.querySelector('meta[property="og:url"]');
        if (postIdMeta) {
          const url = new URL(postIdMeta.content);
          const pathParts = url.pathname.split('/');
          return pathParts[pathParts.length - 1];
        }
        return null;
      },

      loadMore: async function() {
        if (this.isLoading) return;
        this.isLoading = true;
        this.updateLoadMoreButton(true);

        try {
          const data = await this.fetchComments();
          if (data.feed.entry && data.feed.entry.length > 0) {
            this.renderComments(data.feed.entry);
            this.currentPage++;
          } else {
            this.showNoMoreComments();
          }
        } catch (error) {
          this.showError();
        } finally {
          this.isLoading = false;
          this.updateLoadMoreButton(false);
        }
      },

      fetchComments: async function() {
        const apiUrl = `${document.location.origin}/feeds/${this.postId}/comments/default?alt=json&orderby=published&reverse=true&max-results=${MintBlogger.config.commentsPerPage}&start-index=${(this.currentPage - 1) * MintBlogger.config.commentsPerPage + 1}`;
        return await MintBlogger.util.fetchJSON(apiUrl);
      },

      renderComments: function(comments) {
        if (!comments || comments.length === 0) {
          this.showNoMoreComments();
          return;
        }
        const commentsContent = this.container.querySelector('.comments-content');
        comments.forEach(comment => {
          const commentElement = this.createCommentElement(comment);
          commentsContent.appendChild(commentElement);
        });
      },

      createCommentElement: function(comment) {
        const commentId = comment.id.$t.split('-').pop();
        const author = comment.author[0].name.$t;
        const content = comment.content.$t;
        const date = MintBlogger.util.formatDate(comment.published.$t);
        const authorImage = comment.author[0].gd$image.src;
        const authorUrl = comment.author[0].uri ? comment.author[0].uri.$t : null;

        const commentElement = document.createElement('div');
        commentElement.className = 'comment';
        commentElement.id = `c${commentId}`;
        commentElement.innerHTML = `
          <div class="comment-block">
            <div class="comment-header">
              <div class="comment-avatar">
                <img src="${authorImage}" alt="${author}" class="avatar-image">
              </div>
              <div class="comment-meta">
                ${authorUrl ? `<a href="${authorUrl}" class="comment-author">${author}</a>` : `<span class="comment-author">${author}</span>`}
                <span class="comment-time fs-7">${date}</span>
              </div>
            </div>
            <div class="comment-content">${content}</div>
            <div class="comment-footer">
              <button class="comment-reply-button has-icon" data-parent-id="${commentId}">
                <span class="icon">↩</span>
                ${MintBlogger.util.translate('reply')}
              </button>
            </div>
          </div>
        `;

        return commentElement;
      },

      updateLoadMoreButton: function(isLoading) {
        this.loadMoreButton.textContent = isLoading ? MintBlogger.util.translate('loading') : MintBlogger.util.translate('loadMore');
        this.loadMoreButton.disabled = isLoading;
      },

      showNoMoreComments: function() {
        this.loadMoreButton.textContent = MintBlogger.util.translate('noMoreComments');
        this.loadMoreButton.disabled = true;
      },

      showError: function() {
        this.loadMoreButton.textContent = MintBlogger.util.translate('errorOccurred');
        this.loadMoreButton.disabled = true;
      },

      setupCommentReplies: function() {
        const commentForm = document.getElementById("comment-form");
        const formScript = document.getElementById("form-script");
        const formRestore = document.getElementById("form-restore");
        const replyButtons = document.querySelectorAll("[data-parent-id]");
        const ACTIVE_CLASS = "is-active";
        const REPLYING_CLASS = "is-replying";
        const HAS_REPLY_FORM_CLASS = "has-reply-form";

        if (!commentForm) return;

        const originalFormHtml = commentForm.innerHTML;
        const originalSrc = this.parseIframeForm(originalFormHtml).originalSrc;
        let activeButton = null;

        function createReplyForm() {
          const form = document.createElement("div");
          form.id = "reply-form";
          return form;
        }

        function removeExistingReplyForm() {
          const existingForm = document.getElementById("reply-form");
          if (existingForm) {
            existingForm.parentElement.classList.remove(HAS_REPLY_FORM_CLASS);
            existingForm.remove();
          }
        }

        replyButtons.forEach(button => {
          button.onclick = () => {
            const parentId = button.dataset.parentId;
            const repliesContainer = button.closest('.comment').querySelector('.comments-replies');
            
            if (activeButton === button) {
              removeExistingReplyForm();
              button.classList.remove(ACTIVE_CLASS);
              activeButton = null;
              return;
            }

            removeExistingReplyForm();
            
            if (!activeButton) {
              commentForm.innerHTML = "";
              formRestore.classList.add(REPLYING_CLASS);
            }

            if (activeButton) {
              activeButton.classList.remove(ACTIVE_CLASS);
            }

            const newSrc = `${originalSrc}&parentID=${parentId}`;
            const form = this.parseIframeForm(originalFormHtml, newSrc).form;
            const replyForm = createReplyForm();
            
            button.classList.add(ACTIVE_CLASS);
            activeButton = button;
            replyForm.innerHTML = form;
            repliesContainer.classList.add(HAS_REPLY_FORM_CLASS);
            repliesContainer.insertAdjacentElement("afterbegin", replyForm);
          };
        });

        if (formRestore) {
          formRestore.onclick = () => {
            if (activeButton) {
              removeExistingReplyForm();
              formRestore.classList.remove(REPLYING_CLASS);
              commentForm.innerHTML = originalFormHtml;
              activeButton.classList.remove(ACTIVE_CLASS);
              activeButton = null;
            }
          };
        }
      },

      parseIframeForm: function(html, newSrc) {
        if (!html) return {};
        const match = html.match(/<iframe[^>]*\s+src="([^"]*)"/i);
        if (!match) return {};
        const originalSrc = match[1];
        return {
          originalSrc,
          form: newSrc ? html.replace(originalSrc, newSrc) : html
        };
      }
    },

    relatedPosts: {
      // ... (unchanged)
    },

    postUtilities: {
      // ... (unchanged)
    },

    init: function() {
      this.posts.init();
      this.comments.init();
      this.relatedPosts.init();
      this.postUtilities.init();
    }
  };

  // Initialize MintBlogger when the DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', MintBlogger.init.bind(MintBlogger));
  } else {
    MintBlogger.init();
  }

  // Export MintBlogger for use in Blogger templates
  window.MintBlogger = MintBlogger;

})(window, document);
