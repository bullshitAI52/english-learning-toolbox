        // --- Backend API Configuration ---
        // CHANGE THIS TO YOUR SERVER URL
        const API_BASE_URL = window.location.protocol + '//' + window.location.host + '/api';

        let currentUser = null;
        let authToken = null;

        // API Client
        const API = {
            async request(endpoint, options = {}) {
                const url = `${API_BASE_URL}${endpoint}`;
                const headers = {
                    'Content-Type': 'application/json',
                    ...options.headers
                };

                if (authToken) {
                    headers['Authorization'] = `Bearer ${authToken}`;
                }

                try {
                    const response = await fetch(url, {
                        ...options,
                        headers
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Request failed');
                    }

                    return data;
                } catch (error) {
                    console.error('API Error:', error);
                    throw error;
                }
            },

            auth: {
                async register(email, password) {
                    return await API.request('/auth/register', {
                        method: 'POST',
                        body: JSON.stringify({ email, password })
                    });
                },

                async login(email, password) {
                    return await API.request('/auth/login', {
                        method: 'POST',
                        body: JSON.stringify({ email, password })
                    });
                },

                async getMe() {
                    return await API.request('/auth/me');
                },

                async forgotPassword(email) {
                    return await API.request('/auth/forgot-password', {
                        method: 'POST',
                        body: JSON.stringify({ email })
                    });
                },

                async resetPassword(email, code, newPassword) {
                    return await API.request('/auth/reset-password', {
                        method: 'POST',
                        body: JSON.stringify({ email, code, newPassword })
                    });
                }
            },

            wordlists: {
                async list() {
                    return await API.request('/wordlists');
                },
                async getContent(filename) {
                    const res = await fetch(API_BASE_URL + '/wordlists/' + encodeURIComponent(filename), {
                        headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {}
                    });
                    if (!res.ok) throw new Error('Failed to load wordlist');
                    return await res.text();
                },
                async upload(formData) {
                    const res = await fetch(API_BASE_URL + '/admin/upload-wordlist', {
                        method: 'POST',
                        headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {},
                        body: formData
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Upload failed');
                    return data;
                },
                async deleteFile(filename) {
                    return await API.request('/admin/wordlists/' + encodeURIComponent(filename), {
                        method: 'DELETE'
                    });
                }
            },

            progress: {
                async get() {
                    return await API.request('/progress');
                },

                async update(data) {
                    return await API.request('/progress', {
                        method: 'PUT',
                        body: JSON.stringify(data)
                    });
                }
            },

            stats: {
                async getAll() {
                    return await API.request('/stats');
                },

                async update(word, correct, wrong, last_practiced) {
                    return await API.request('/stats', {
                        method: 'POST',
                        body: JSON.stringify({ word, correct, wrong, last_practiced })
                    });
                }
            }
        };

        let allWordData = []; // Store complete dataset
        let displayData = []; // Store filtered data for display
        let currentPage = 1;
        let startTime;
        let spellTimeout;
        let currentMode = 'all'; // 'all', 'new', 'mistake'
        const WORDS_PER_PAGE = 10;
        const youdaoAPI = 'https://dict.youdao.com/dictvoice?audio=';

        // --- Auth Functions ---
        let isLoginMode = true;

        function openAuthModal() {
            document.getElementById('authModal').style.display = 'flex';
            resetAuthUI();
        }

        function closeAuthModal() {
            document.getElementById('authModal').style.display = 'none';
            resetAuthUI();
        }

        function toggleAuthMode() {
            isLoginMode = !isLoginMode;
            resetAuthUI();
        }

        let isForgotMode = false;

        function showForgotPassword() {
            isForgotMode = true;
            document.getElementById('authTitle').innerText = '找回密码';
            document.getElementById('authPassword').style.display = 'none';
            document.getElementById('authActionBtn').innerText = '获取重置码';
            document.getElementById('authActionBtn').onclick = handleForgotPassword;
            document.getElementById('authSwitchText').innerText = '想起密码了？点击登录';
            document.getElementById('forgotPwdLink').style.display = 'none';
            document.getElementById('authError').style.display = 'none';
        }

        async function handleForgotPassword() {
            const email = document.getElementById('authEmail').value;
            const errorEl = document.getElementById('authError');
            const btn = document.getElementById('authActionBtn');

            if (!email) {
                errorEl.innerText = '请输入您的注册邮箱';
                errorEl.style.display = 'block';
                return;
            }

            btn.innerText = '处理中...';
            btn.disabled = true;

            try {
                const result = await API.auth.forgotPassword(email);
                errorEl.style.color = '#28a745';
                errorEl.innerText = result.message;
                errorEl.style.display = 'block';
                // Switch to reset mode
                setTimeout(function() {
                    showResetPassword();
                }, 1500);
            } catch (err) {
                errorEl.style.color = '#dc3545';
                errorEl.innerText = err.message;
                errorEl.style.display = 'block';
            } finally {
                btn.innerText = '获取重置码';
                btn.disabled = false;
            }
        }

        function showResetPassword() {
            isForgotMode = false;
            document.getElementById('authTitle').innerText = '重置密码';
            document.getElementById('authPassword').style.display = 'block';
            document.getElementById('authPassword').placeholder = '新密码 (至少6位)';
            document.getElementById('authActionBtn').innerText = '重置密码';
            document.getElementById('authActionBtn').onclick = handleResetPassword;
            document.getElementById('authError').style.display = 'none';
            document.getElementById('authError').style.color = '#dc3545';

            var pwInput = document.getElementById('authPassword');
            if (!document.getElementById('resetCodeInput')) {
                var codeInput = document.createElement('input');
                codeInput.type = 'text';
                codeInput.id = 'resetCodeInput';
                codeInput.className = 'auth-input';
                codeInput.placeholder = '请输入管理员给你的6位重置码';
                codeInput.style.cssText = pwInput.style.cssText;
                pwInput.parentNode.insertBefore(codeInput, pwInput);
            }
            document.getElementById('resetCodeInput').value = '';
            document.getElementById('authPassword').value = '';
        }

        function resetAuthUI() {
            isForgotMode = false;
            document.getElementById('authTitle').innerText = isLoginMode ? '登录云端' : '注册新账号';
            document.getElementById('authActionBtn').innerText = isLoginMode ? '立即登录' : '立即注册';
            document.getElementById('authActionBtn').onclick = handleAuthAction;
            document.getElementById('authSwitchText').innerText = isLoginMode ? '没有账号？点击注册' : '已有账号？点击登录';
            document.getElementById('authError').style.display = 'none';
            document.getElementById('authError').style.color = '#dc3545';
            document.getElementById('forgotPwdLink').style.display = '';
            document.getElementById('authPassword').style.display = 'block';
            document.getElementById('authPassword').placeholder = '密码 (Password - min 6 chars)';
            var codeInput = document.getElementById('resetCodeInput');
            if (codeInput) codeInput.remove();
        }

        async function handleAuthAction() {
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const errorEl = document.getElementById('authError');
            const btn = document.getElementById('authActionBtn');

            errorEl.style.display = 'none';

            if (!email || !password || password.length < 6) {
                errorEl.innerText = '请输入有效的邮箱和密码（密码至少6位）';
                errorEl.style.display = 'block';
                return;
            }

            const originalText = btn.innerText;
            btn.innerText = '处理中...';
            btn.disabled = true;

            try {
                let result;
                if (isLoginMode) {
                    result = await API.auth.login(email, password);
                } else {
                    result = await API.auth.register(email, password);
                }

                // Save token and user
                authToken = result.token;
                localStorage.setItem('authToken', authToken);
                currentUser = result.user;

                closeAuthModal();
                updateUserSession(currentUser);

                if (!isLoginMode) {
                    showToast('✅ 注册成功！', 'success');
                }

            } catch (err) {
                errorEl.innerText = err.message;
                errorEl.style.display = 'block';
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }

        async function handleResetPassword() {
            const email = document.getElementById('authEmail').value;
            const codeInput = document.getElementById('resetCodeInput');
            const code = codeInput ? codeInput.value : '';
            const newPassword = document.getElementById('authPassword').value;
            const errorEl = document.getElementById('authError');
            const btn = document.getElementById('authActionBtn');

            errorEl.style.color = '#dc3545';
            errorEl.style.display = 'none';

            if (!email || !code || !newPassword || newPassword.length < 6) {
                errorEl.innerText = '请填写邮箱、重置码和新密码（至少6位）';
                errorEl.style.display = 'block';
                return;
            }

            btn.innerText = '处理中...';
            btn.disabled = true;

            try {
                const result = await API.auth.resetPassword(email, code, newPassword);
                errorEl.style.color = '#28a745';
                errorEl.innerText = result.message;
                errorEl.style.display = 'block';
                setTimeout(function() {
                    resetAuthUI();
                    isLoginMode = true;
                    resetAuthUI();
                }, 2000);
            } catch (err) {
                errorEl.style.color = '#dc3545';
                errorEl.innerText = err.message;
                errorEl.style.display = 'block';
            } finally {
                btn.innerText = '重置密码';
                btn.disabled = false;
            }
        }

        async function signOut() {
            authToken = null;
            currentUser = null;
            localStorage.removeItem('authToken');
            window.location.reload();
        }

        // Auth Init
        document.addEventListener('DOMContentLoaded', async () => {
            // Theme Init
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.documentElement.setAttribute('data-theme', savedTheme);

            // Check for saved token
            authToken = localStorage.getItem('authToken');

            if (authToken) {
                try {
                    const result = await API.auth.getMe();
                    currentUser = result.user;
                    updateUserSession(currentUser);
                } catch (error) {
                    console.warn('Token invalid or expired:', error);
                    localStorage.removeItem('authToken');
                    authToken = null;
                    updateUserSession(null);
                }
            } else {
                updateUserSession(null);
            }
        });

        function updateUserSession(user) {
            currentUser = user;
            const userSection = document.getElementById('userSection');
            const loginBtn = document.getElementById('loginBtn');
            const adminPanelBtn = document.getElementById('adminPanelBtn');
            const fileInput = document.getElementById('fileInput');
            const fileSelectBtn = document.getElementById('fileSelectBtn');
            const fileStatus = document.getElementById('fileStatus');
            const libraryToggleBtn = document.getElementById('libraryToggleBtn');

            if (currentUser) {
                document.getElementById('userEmail').innerText = currentUser.email;
                userSection.style.display = 'flex';
                loginBtn.style.display = 'none';

                // Show admin button if user is admin
                if (currentUser.is_admin) {
                    adminPanelBtn.style.display = 'inline-block';
                    // Load pending users count for badge
                    loadPendingCount();
                }

                // Enable file selection for logged-in users
                if (fileInput) fileInput.disabled = false;
                if (fileSelectBtn) fileSelectBtn.disabled = false;
                if (fileStatus) fileStatus.innerText = '👆 请选择CSV词库文件,或使用示例数据';

                // Enable library toggle
                if (libraryToggleBtn) {
                    libraryToggleBtn.disabled = false;
                    libraryToggleBtn.title = '打开词库列表';
                }

                // Load cloud data
                CloudPersistence.load();
            } else {
                userSection.style.display = 'none';
                loginBtn.style.display = 'block';
                if (adminPanelBtn) adminPanelBtn.style.display = 'none';

                // Disable file selection for non-logged-in users
                if (fileInput) fileInput.disabled = true;
                if (fileSelectBtn) fileSelectBtn.disabled = true;
                if (fileStatus) fileStatus.innerText = '⚠️ 请先登录后才能导入词库';

                // Disable library toggle
                if (libraryToggleBtn) {
                    libraryToggleBtn.disabled = true;
                    libraryToggleBtn.title = '登录后查看词库列表';
                }
                autoLoadCSV(); // Fallback to local
            }
        }

        // --- Admin Panel Functions ---
        async function loadPendingCount() {
            try {
                const response = await API.request('/admin/pending-users');
                const count = (response.users || []).length;
                const badge = document.getElementById('adminBadge');

                if (count > 0 && badge) {
                    badge.innerText = count;
                    badge.style.display = 'block';
                } else if (badge) {
                    badge.style.display = 'none';
                }
            } catch (error) {
                console.error('Failed to load pending count:', error);
            }
        }

        function openAdminPanel() {
            document.getElementById('adminModal').style.display = 'flex';
            loadPendingUsers();
            loadSharedForAdmin();
        }

        async function loadSharedForAdmin() {
            var container = document.getElementById('sharedWordlistList');
            if (!container) return;
            try {
                var resp = await API.wordlists.list();
                var files = resp.files || [];
                if (files.length === 0) {
                    container.innerHTML = '<p style="text-align:center; color:#666;">暂无共享词库</p>';
                } else {
                    container.innerHTML = files.map(function(f) {
                        var safeName = f.name.replace(/'/g, "\\'");
                        return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid var(--border-color); border-radius:6px; margin-bottom:5px;"><span>' + f.name + '</span><button class="btn btn-secondary" style="background:#dc3545; color:#fff; padding:4px 10px; font-size:12px; min-height:auto;" onclick="deleteSharedWordlist(\'' + safeName + '\')">删除</button></div>';
                    }).join('');
                }
            } catch(e) {
                container.innerHTML = '<p style="text-align:center; color:#dc3545;">加载失败</p>';
            }
        }

        function uploadSharedWordlist() {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.txt';
            input.onchange = async function() {
                if (!input.files[0]) return;
                var formData = new FormData();
                formData.append('file', input.files[0]);
                try {
                    var result = await API.wordlists.upload(formData);
                    showToast(result.message, 'success');
                    loadSharedForAdmin();
                    loadSharedWordlists();
                } catch(e) {
                    showToast('上传失败: ' + e.message, 'error');
                }
            };
            input.click();
        }

        async function deleteSharedWordlist(filename) {
            if (!(await showConfirm('确定删除 ' + filename + '？', '删除', '取消', true))) return;
            try {
                await API.wordlists.deleteFile(filename);
                showToast('已删除', 'success');
                loadSharedForAdmin();
                loadSharedWordlists();
            } catch(e) {
                showToast('删除失败: ' + e.message, 'error');
            }
        }

        async function loadResetCodes() {
            var container = document.getElementById('resetCodesList');
            container.innerHTML = '<p style="text-align:center;">加载中...</p>';
            try {
                var response = await API.request('/admin/reset-codes');
                if (!response.codes || response.codes.length === 0) {
                    container.innerHTML = '<p style="text-align:center; color:#666;">无待处理的密码重置</p>';
                    return;
                }
                var html = '';
                response.codes.forEach(function(r) {
                    var expiresIn = Math.max(0, Math.floor((r.expires_at - Date.now()) / 60000));
                    html += '<div style="padding:10px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:8px;">';
                    html += '<strong>' + r.email + '</strong><br>';
                    html += '重置码: <code style="font-size:18px; letter-spacing:2px; color:#007BFF;">' + r.code + '</code><br>';
                    html += '有效期: ' + expiresIn + ' 分钟</div>';
                });
                container.innerHTML = html;
            } catch (error) {
                container.innerHTML = '<p style="text-align:center; color:#dc3545;">加载失败: ' + error.message + '</p>';
            }
        }

        function closeAdminPanel() {
            document.getElementById('adminModal').style.display = 'none';
        }

        async function loadPendingUsers() {
            const container = document.getElementById('pendingUsersList');
            container.innerHTML = '<p style="text-align:center; color:#666;">加载中...</p>';

            try {
                const response = await API.request('/admin/pending-users');
                const users = response.users || [];

                if (users.length === 0) {
                    container.innerHTML = '<p style="text-align:center; color:#666;">🎉 没有待审核用户</p>';
                    return;
                }

                container.innerHTML = users.map(user => `
                    <div style="border: 1px solid var(--border-color); padding: 15px; margin: 10px 0; border-radius: 8px; background: var(--card-bg);">
                        <div style="margin-bottom: 10px;">
                            <strong>📧 邮箱:</strong> ${user.email}<br>
                            <span style="font-size: 12px; color: #666;">注册时间: ${new Date(user.created_at).toLocaleString('zh-CN')}</span>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-primary" onclick="approveUser(${user.id})" style="background-color: #28a745;">✅ 批准</button>
                            <button class="btn btn-secondary" onclick="rejectUser(${user.id})" style="background-color: #dc3545; color: white;">❌ 拒绝</button>
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                container.innerHTML = '<p style="text-align:center; color:#dc3545;">❌ 加载失败: ' + error.message + '</p>';
            }
        }


        // --- Toast & Confirm Utilities ---
        function showToast(msg, type) {
            type = type || 'info';
            var container = document.getElementById('toastContainer');
            var toast = document.createElement('div');
            toast.className = 'toast toast-' + type;
            toast.textContent = msg;
            toast.onclick = function() { toast.remove(); };
            container.appendChild(toast);
            setTimeout(function() { if (toast.parentNode) toast.remove(); }, 2800);
        }

        function showConfirm(msg, okText, cancelText, isDanger) {
            return new Promise(function(resolve) {
                var overlay = document.getElementById('confirmOverlay');
                document.getElementById('confirmMsg').textContent = msg;
                var okBtn = document.getElementById('confirmOkBtn');
                okBtn.textContent = okText || '确定';
                okBtn.style.background = isDanger ? '#dc3545' : '#28a745';
                document.getElementById('confirmCancelBtn').textContent = cancelText || '取消';
                overlay.classList.add('show');

                function cleanup() {
                    overlay.classList.remove('show');
                    okBtn.removeEventListener('click', onOk);
                    document.getElementById('confirmCancelBtn').removeEventListener('click', onCancel);
                }
                function onOk() { cleanup(); resolve(true); }
                function onCancel() { cleanup(); resolve(false); }

                okBtn.addEventListener('click', onOk);
                document.getElementById('confirmCancelBtn').addEventListener('click', onCancel);
            });
        }

        async function approveUser(userId) {
            if (!(await showConfirm('确定批准该用户？', '批准', '取消', false))) return;

            try {
                await API.request('/admin/approve-user', {
                    method: 'POST',
                    body: JSON.stringify({ userId })
                });
                showToast('✅ 已批准！', 'success');
                loadPendingUsers(); // Refresh list
                loadPendingCount(); // Update badge
            } catch (error) {
                showToast('❌ 操作失败: ' + error.message, 'error');
            }
        }

        async function rejectUser(userId) {
            if (!(await showConfirm('确定拒绝该用户？该操作将删除用户账号。', '拒绝删除', '取消', true))) return;

            try {
                await API.request('/admin/reject-user', {
                    method: 'POST',
                    body: JSON.stringify({ userId })
                });
                showToast('✅ 已拒绝并删除！', 'success');
                loadPendingUsers(); // Refresh list
                loadPendingCount(); // Update badge
            } catch (error) {
                showToast('❌ 操作失败: ' + error.message, 'error');
            }
        }

        // --- Help Modal Functions ---
        function openHelpModal() {
            document.getElementById('helpModal').style.display = 'flex';
        }

        function closeHelpModal() {
            document.getElementById('helpModal').style.display = 'none';
        }


        // Base64 Simple Ding Sound
        const correctSoundBase64 = "data:audio/wav;base64,UklGRl9vTNEAAXdvYmtuPgPNEDYAAA..."; // Placeholder for short ding, let's use a real short base64 or a free url? 
        // Using a short beep URL for simplicity to avoid huge file, or generated one.
        // Actually, best to use a web audio API oscillator for zero-dependency "ding".

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        function playCorrectSound() {
            if (audioContext.state === 'suspended') audioContext.resume();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // "Ding" effect: High pitch decaying fast
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime); // High C
            oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        }

        // --- Persistence Manager ---
        const CloudPersistence = {
            async saveProgress(filename, content, page) {
                if (!currentUser || !authToken) return;

                try {
                    await API.progress.update({
                        last_file: filename,
                        last_content: content,
                        last_page: page
                    });
                } catch (error) {
                    console.error('Cloud save failed:', error);
                }
            },

            async load() {
                if (!currentUser || !authToken) return;

                try {
                    const { progress } = await API.progress.get();

                    if (progress && progress.last_file) {
                        // Update local state to match cloud
                        localStorage.setItem('last_csv_filename', progress.last_file);
                        localStorage.setItem('last_csv_content', progress.last_content);
                        localStorage.setItem('last_page', progress.last_page);

                        // Trigger load
                        autoLoadCSV();
                    } else {
                        // No cloud data, first sync
                        autoLoadCSV();
                    }
                } catch (error) {
                    console.error('Cloud load failed:', error);
                    autoLoadCSV();
                }
            }
        };

        const DataPersistence = {
            save(filename, content) {
                try {
                    localStorage.setItem('last_csv_filename', filename);
                    localStorage.setItem('last_csv_content', content);
                    if (currentUser) CloudPersistence.saveProgress(filename, content, currentPage);
                } catch (e) { console.error('Storage full?', e); }
            },

            load() {
                const filename = localStorage.getItem('last_csv_filename');
                const content = localStorage.getItem('last_csv_content');
                if (filename && content) {
                    return { filename, content };
                }
                return null;
            },

            savePage(page) {
                localStorage.setItem('last_page', page);
                if (currentUser) {
                    const { filename, content } = this.load() || {};
                    if (filename) CloudPersistence.saveProgress(filename, content, page);
                }
            },

            loadPage() {
                return parseInt(localStorage.getItem('last_page') || 1);
            }
        };

        // --- Stats Manager ---
        const WordStats = {
            storageKey: 'word_spelling_stats',
            data: {},

            async init() {
                // Try load local first
                const stored = localStorage.getItem(this.storageKey);
                if (stored) {
                    this.data = JSON.parse(stored);
                }

                // If logged in, sync with cloud
                if (currentUser && authToken) {
                    try {
                        const { stats } = await API.stats.getAll();

                        if (stats) {
                            stats.forEach(row => {
                                this.data[row.word] = {
                                    correct: row.correct,
                                    wrong: row.wrong,
                                    lastPracticed: row.last_practiced
                                };
                            });
                            this.saveFunc(); // Update local storage
                        }
                    } catch (error) {
                        console.error('Failed to load stats from cloud:', error);
                    }
                }
            },

            saveFunc() {
                localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            },

            async save(word, stat) {
                this.saveFunc();

                if (currentUser && authToken && word) {
                    try {
                        await API.stats.update(word, stat.correct, stat.wrong, stat.lastPracticed);
                    } catch (error) {
                        console.error('Failed to save stat to cloud:', error);
                    }
                }
            },

            get(word) {
                return this.data[word] || { correct: 0, wrong: 0, lastPracticed: 0 };
            },

            update(word, isCorrect) {
                if (!this.data[word]) {
                    this.data[word] = { correct: 0, wrong: 0, lastPracticed: 0 };
                }
                const stat = this.data[word];
                if (isCorrect) stat.correct++;
                else stat.wrong++;
                stat.lastPracticed = Date.now();
                this.save(word, stat);
            }
        };

        // Initialize Stats (will be re-called on auth change if needed, but for now simple init)
        WordStats.init();

        // Reset all mastered words
        async function resetAllMastered() {
            const masteredCount = allWordData.filter(w => {
                const stats = WordStats.get(w.english);
                return stats.correct >= 3 && stats.wrong === 0;
            }).length;

            if (masteredCount === 0) {
                showToast('没有已背熟的单词哦！', 'info');
                return;
            }

            if (await showConfirm('确定要重置所有已背熟的单词吗？\n\n将清空 ' + masteredCount + ' 个单词的学习记录！', '确认重置', '取消', true)) {
                let resetCount = 0;
                allWordData.forEach(w => {
                    const stats = WordStats.get(w.english);
                    if (stats.correct >= 3 && stats.wrong === 0) {
                        WordStats.data[w.english] = { correct: 0, wrong: 0, lastPracticed: 0 };
                        WordStats.save(w.english, WordStats.data[w.english]);
                        resetCount++;
                    }
                });

                // Refresh display
                filterData();
                renderPage(1);
                renderPagination();
                showToast('✅ 已重置 ' + resetCount + ' 个单词！', 'success');
            }
        }

        function switchMode(mode) {
            currentMode = mode;

            // Update UI
            document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active'); // Note: this relies on event bubbling/binding

            filterData();
            currentPage = 1;
            renderPage(1);
            renderPagination();
        }

        function filterData() {
            // Helper function to check if word is mastered
            const isMastered = (word) => {
                const stats = WordStats.get(word.english);
                return stats.correct >= 3 && stats.wrong === 0;
            };

            if (currentMode === 'all') {
                // Show ALL words (including mastered)
                displayData = [...allWordData];
            } else if (currentMode === 'new') {
                displayData = allWordData.filter(w => {
                    if (isMastered(w)) return false; // Exclude mastered
                    const stats = WordStats.get(w.english);
                    return stats.correct === 0 && stats.wrong === 0;
                });
            } else if (currentMode === 'mistake') {
                displayData = allWordData.filter(w => {
                    if (isMastered(w)) return false; // Exclude mastered
                    const stats = WordStats.get(w.english);
                    return stats.wrong > 0 && (stats.wrong > stats.correct); // Only showing words where errors exceed correct answers, or just any error? User said "易错题". Let's simply show any that have errors > 0 for now, sorted by error count.
                }).sort((a, b) => {
                    const statsA = WordStats.get(a.english);
                    const statsB = WordStats.get(b.english);
                    return statsB.wrong - statsA.wrong; // Descending order of mistakes
                });
            } else if (currentMode === 'mastered') {
                // Show only mastered words
                displayData = allWordData.filter(w => isMastered(w));
            }

            // If mistake/new mode is empty, show alert or fallback? 
            if (displayData.length === 0 && allWordData.length > 0) {
                // Optional: Auto-switch back or show empty state. 
                // For now just letting it render empty list 
            }
        }

        function updateTime() {
            const now = new Date();
            document.getElementById('currentTime').textContent = `当前时间: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
        setInterval(updateTime, 60000);
        updateTime();

        // 文件输入处理
        document.querySelector('.file-input-wrapper button').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('timerBtn').addEventListener('click', () => {
            if (!startTime) {
                startTime = Date.now();
                document.getElementById('timerBtn').textContent = '⏸️ 停止计时';
                setInterval(() => {
                    if (startTime) {
                        let elapsed = Math.floor((Date.now() - startTime) / 1000);
                        document.getElementById('elapsedTimeDisplay').textContent = `已用时间: ${elapsed} 秒`;
                    }
                }, 1000);
            } else {
                startTime = null;
                document.getElementById('timerBtn').textContent = '⏱️ 开始计时';
            }
        });

        document.getElementById('screenshotBtn').addEventListener('click', () => {
            html2canvas(document.body, {
                scale: window.devicePixelRatio || 1,
                useCORS: true
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `拼写检测截图_${new Date().toISOString().slice(0, 19)}.png`;
                link.href = canvas.toDataURL();
                link.click();
            });
        });

        document.getElementById('fileInput').addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    parseCSVData(e.target.result, file.name);
                };
                reader.readAsText(file);
            }
        });

        function renderPage(page) {
            currentPage = page;
            DataPersistence.savePage(page); // Save current page
            const start = (page - 1) * WORDS_PER_PAGE;

            if (displayData.length === 0) {
                document.getElementById('wordList').innerHTML = `<div style="text-align:center; padding: 20px; color: #666;">当前模式下没有单词哦 🎉</div>`;
                return;
            }

            const words = displayData.slice(start, start + WORDS_PER_PAGE);
            document.getElementById('wordList').innerHTML = words.map((word, index) => {
                const stats = WordStats.get(word.english);
                return `
                <div class="word-item">
                    <div class="chinese-text">${word.chinese}</div>
                    <div class="word-stats">
                        <span class="stat-badge correct">✓ ${stats.correct}</span>
                        <span class="stat-badge wrong">✗ ${stats.wrong}</span>
                        ${stats.correct >= 3 && stats.wrong === 0 ? '<span class="stat-badge" style="background:#d4edda; color:#155724;">✅ 已背熟</span>' : ''}
                    </div>
                    <div class="input-container">
                        <input type="text" class="input-box" 
                               placeholder="请输入英文单词..." 
                               oninput="checkSpelling(this, '${word.english}', this.nextElementSibling)"
                               autocomplete="off"
                               autocorrect="off"
                               autocapitalize="off"
                               spellcheck="false">
                        <span class="check-icon">❌</span>
                    </div>
                    <div class="action-buttons">
                        <button class="btn-icon btn-sound" onclick="playSound('${word.english}')" title="播放发音">🔊</button>
                        <button class="btn-icon btn-spell" onclick="showSpelling('${word.english}')" title="拼写示范">✏️</button>
                    </div>
                </div>
            `}).join('');
        }

        function renderPagination() {
            const totalPages = Math.ceil(displayData.length / WORDS_PER_PAGE);
            const pagination = document.getElementById('pagination');
            pagination.innerHTML = '';

            if (totalPages <= 1) return;

            // 上一页按钮
            if (currentPage > 1) {
                const prevButton = document.createElement('button');
                prevButton.innerHTML = '‹ 上一页';
                prevButton.addEventListener('click', () => {
                    renderPage(currentPage - 1);
                    renderPagination();
                });
                pagination.appendChild(prevButton);
            }

            // 页码按钮（显示当前页前后各2页）
            const start = Math.max(1, currentPage - 2);
            const end = Math.min(totalPages, currentPage + 2);

            if (start > 1) {
                const firstButton = document.createElement('button');
                firstButton.textContent = '1';
                firstButton.addEventListener('click', () => {
                    renderPage(1);
                    renderPagination();
                });
                pagination.appendChild(firstButton);

                if (start > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.style.padding = '0 10px';
                    pagination.appendChild(ellipsis);
                }
            }

            for (let i = start; i <= end; i++) {
                const button = document.createElement('button');
                button.textContent = i;
                button.classList.toggle('active', i === currentPage);
                button.addEventListener('click', () => {
                    renderPage(i);
                    renderPagination();
                });
                pagination.appendChild(button);
            }

            if (end < totalPages) {
                if (end < totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.style.padding = '0 10px';
                    pagination.appendChild(ellipsis);
                }

                const lastButton = document.createElement('button');
                lastButton.textContent = totalPages;
                lastButton.addEventListener('click', () => {
                    renderPage(totalPages);
                    renderPagination();
                });
                pagination.appendChild(lastButton);
            }

            // 下一页按钮
            if (currentPage < totalPages) {
                const nextButton = document.createElement('button');
                nextButton.innerHTML = '下一页 ›';
                nextButton.addEventListener('click', () => {
                    renderPage(currentPage + 1);
                    renderPagination();
                });
                pagination.appendChild(nextButton);
            }
        }

        // Mobile Keyboard Fix: Scroll to center on focus
        document.addEventListener('focus', (e) => {
            if (e.target.tagName === 'INPUT') {
                setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
        }, true);

        function levenshtein(a, b) {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;
            var matrix = [];
            for (var i = 0; i <= b.length; i++) matrix[i] = [i];
            for (var j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (var i = 1; i <= b.length; i++) {
                for (var j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) === a.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                    }
                }
            }
            return matrix[b.length][a.length];
        }

        function checkSpelling(input, correctWord, icon) {
            const userInput = input.value.trim().toLowerCase();
            const correct = correctWord.toLowerCase();

            // Prevent duplicate stats update for same input session?
            // Simple logic: update on first success or failure per focus session?
            // For simplicity: update on every change that matches result? No, that's too much.
            // Better: Update only when user hits Enter? Or just rely on visual feedback?
            // User requirement: "自动记录". Usually means when they get it right or wrong.
            // To avoid spamming stats while typing:
            // 1. Only mark correct when exact match.
            // 2. Mark wrong? Hard to define "finished typing wrong".
            // Let's stick to: If they enter correct word -> Correct ++.
            // If they give up/check answer (not implemented yet) -> Wrong ++.
            // Current code is oninput.
            // Let's add a "checked" flag to the input element to avoid double counting?

            if (userInput === correct) {
                if (!input.dataset.solved) {
                    WordStats.update(correctWord, true);
                    input.dataset.solved = "true";
                    playCorrectSound(); // Play Ding!
                    // Refresh stats view? No, might re-render and lose focus. 
                    // Let's just update backend. Next render will show it.
                }

                icon.innerHTML = "✅";
                icon.style.color = "green";
                icon.style.display = "inline";
                input.style.borderColor = "#28a745";
                input.style.backgroundColor = "#d4edda";
            } else if (userInput === '') {
                icon.style.display = "none";
                input.style.borderColor = "#ddd";
                input.style.backgroundColor = "#fafafa";
            } else {
                // Check if it's a "complete" attempt? 
                // Difficult to know oninput. 
                // Maybe we only count WRONG when they click "Next" or "Reveal"?
                // Or we can add an explicit "Check" button?
                // The current UI is real-time. 
                // Let's NOT count "Wrong" on simple typos while typing.
                // We will count "Wrong" if they use the "Spell" (Show Answer) button.

                icon.innerHTML = "❌";
                icon.style.color = "red";
                icon.style.display = "inline";
                input.style.borderColor = "#dc3545";
                input.style.backgroundColor = "#f8d7da";
            }
        }

        function playSound(word) {
            try {
                const audio = new Audio(`${youdaoAPI}${encodeURIComponent(word)}&type=1`);
                audio.play().catch(e => {
                    console.log('音频播放失败:', e);
                    // 可以添加备用发音源或提示
                });
            } catch (e) {
                console.log('创建音频失败:', e);
            }
        }

        function showSpelling(word) {
            // If user asks for answer, count as WRONG
            WordStats.update(word, false);

            if (spellTimeout) {
                clearTimeout(spellTimeout);
            }

            const spellContainer = document.getElementById('spellContainer');
            const letters = word.split('');

            spellContainer.innerHTML = `
                <button class="close-spell" onclick="closeSpelling()">×</button>
                ${letters.map((letter, index) => `
                    <span class="spell-letter" style="animation-delay: ${index * 0.3}s">${letter}</span>
                `).join('')}
            `;

            spellContainer.style.display = 'flex';

            // 自动关闭并播放发音
            spellTimeout = setTimeout(() => {
                closeSpelling();
                playSound(word);
            }, (letters.length * 300) + 2000);
        }

        function closeSpelling() {
            document.getElementById('spellContainer').style.display = 'none';
            if (spellTimeout) {
                clearTimeout(spellTimeout);
                spellTimeout = null;
            }
        }

        // 添加触摸事件支持
        document.addEventListener('touchstart', function () { }, true);

        // 防止双击缩放
        document.addEventListener('touchend', function (event) {
            const now = Date.now();
            if (this.lastTouchEnd && now - this.lastTouchEnd < 350) {
                event.preventDefault();
            }
            this.lastTouchEnd = now;
        }, false);

        // 页面加载时自动尝试加载同目录下的CSV文件
        async function autoLoadCSV() {
            console.log("正在尝试自动加载数据...");

            const lastFilename = localStorage.getItem('last_csv_filename');
            const savedPage = DataPersistence.loadPage();
            let loaded = false;

            // Priority 1: Try to refresh from server (Fixes stale cache issue)
            if (lastFilename) {
                try {
                    // Try to fetch using the filename (decoding it to ensure path is correct if encoded)
                    // If it's a local file name that doesn't exist on server, this simply fails (404)
                    const response = await fetch(lastFilename);
                    if (response.ok) {
                        const text = await response.text();
                        if (text && text.trim().length > 0) {
                            console.log('从服务器刷新文件成功:', lastFilename);
                            parseCSVData(text, lastFilename, true); // Update cache with new content

                            const status = document.querySelector('.file-status');
                            status.innerHTML = `已加载: ${lastFilename} <span style="font-size:10px; color:#999;">(已更新)</span>`;
                            status.style.color = '#28a745';

                            if (savedPage > 1) showResumeModal(savedPage);
                            else { renderPage(1); renderPagination(); }
                            loaded = true;
                        }
                    }
                } catch (e) {
                    // Fetch failed (network error or not a http file), fall back to cache
                    console.log('服务器文件获取失败, 转用缓存:', e);
                }
            }

            // Priority 2: Use cached content (For offline mode or local uploaded files)
            if (!loaded) {
                const lastSession = DataPersistence.load();
                if (lastSession) {
                    console.log('从缓存/上次会话恢复数据:', lastSession.filename);
                    parseCSVData(lastSession.content, lastSession.filename, false);

                    const status = document.querySelector('.file-status');
                    status.innerHTML = `已加载: ${lastSession.filename} <span style="font-size:10px; color:#999;">(自动恢复)</span>`;
                    status.style.color = '#28a745';

                    if (savedPage > 1) showResumeModal(savedPage);
                    else { renderPage(1); renderPagination(); }
                    loaded = true;
                }
            }

            if (loaded) return;

            // Auto-load B3U7 ART P113.csv by default
            const defaultFiles = [
                'B3U7_ART_P113.csv',  // Use underscore instead of spaces
                'B3U7 ART P113.csv',  // Fallback to original name
                'anki_words.csv'
            ];

            for (const filename of defaultFiles) {
                try {
                    const response = await fetch(filename);
                    if (response.ok) {
                        const text = await response.text();
                        if (text.trim()) {
                            console.log(`Successfully loaded: ${filename}`);
                            parseCSVData(text, filename);
                            return;
                        }
                    }
                } catch (error) {
                    console.log(`Failed to load ${filename}:`, error);
                }
            }

            // Show example data if no CSV file found
            showExampleData();
        }

        function showResumeModal(page) {
            document.getElementById('savedParams').textContent = page;
            document.getElementById('resumeModal').style.display = 'flex';
        }

        function handleResume(resume) {
            document.getElementById('resumeModal').style.display = 'none';
            if (resume) {
                const savedPage = DataPersistence.loadPage();
                renderPage(savedPage);
            } else {
                renderPage(1);
            }
            renderPagination();
        }

        function parseCSVData(text, filename, save = true) {
            allWordData = text.split('\n').map(line => {
                const parts = line.split(',');
                return parts.length >= 2 ? {
                    english: parts[0].trim(),
                    chinese: parts.slice(1).join(',').trim()
                } : null;
            }).filter(word => word && word.english && word.chinese);

            if (allWordData.length > 0) {
                if (save) {
                    DataPersistence.save(filename, text);
                    DataPersistence.savePage(1); // Reset page on new file load
                }

                document.querySelector('.file-status').textContent = `已加载: ${filename} (${allWordData.length}个单词)`;
                document.querySelector('.file-status').style.color = '#28a745';

                filterData();

                if (save) {
                    renderPage(1);
                    renderPagination();
                }
            } else {
                showExampleData();
            }
        }

        function hideFileInput() {
            const fileWrapper = document.querySelector('.file-input-wrapper');
            fileWrapper.style.display = 'none';
        }

        function showExampleData() {
            allWordData = [
                { english: 'hello', chinese: '你好' },
                { english: 'world', chinese: '世界' },
                { english: 'computer', chinese: '计算机' },
                { english: 'mobile', chinese: '移动的' },
                { english: 'tablet', chinese: '平板电脑' }
            ];
            document.querySelector('.file-status').innerHTML = '📝 当前使用示例数据 (5个单词)<br><span style="font-size:11px;">💡 点击上方"📁 选择文件"导入您的CSV词库</span>';
            document.querySelector('.file-status').style.color = '#ffc107';

            filterData();
            renderPage(1);
            renderPagination();
        }



        // --- Theme Feature ---
        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'dark' : 'dark';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        }

        // --- Library Feature ---
        let libraryFiles = [];

        function toggleLibrary() {
            const drawer = document.getElementById('libraryDrawer');
            drawer.classList.toggle('open');
            if (drawer.classList.contains('open')) loadSharedWordlists();
        }

        function handleFolderSelect(input) {
            const files = Array.from(input.files).filter(f => f.name.endsWith('.csv') || f.name.endsWith('.txt'));
            if (files.length === 0) {
                showToast('未找到CSV或TXT文件', 'error');
                return;
            }

            // Sort files by name naturally
            files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            libraryFiles = files;

            renderLibraryList();
        }

        var sharedWordlistNames = [];

        async function loadSharedWordlists() {
            if (!authToken) return;
            try {
                var resp = await API.wordlists.list();
                sharedWordlistNames = (resp.files || []).map(function(f) { return f.name; });
            } catch(e) {
                sharedWordlistNames = [];
            }
            renderLibraryList();
        }

        function renderLibraryList() {
            var list = document.getElementById('libraryList');
            var html = libraryFiles.map(function(file, index) {
                return '<li class="library-item" onclick="loadLibraryFile(' + index + ')">' + file.name + '</li>';
            }).join('');
            if (sharedWordlistNames.length > 0) {
                html += '<li style="padding:8px 12px; font-size:12px; color:var(--text-secondary); border-bottom:1px solid var(--border-color);">共享词库</li>';
                html += sharedWordlistNames.map(function(name) {
                    return '<li class="library-item" onclick="loadSharedWordlist('' + name.replace(/'/g, "\\'") + '')">' + name + '</li>';
                }).join('');
            }
            list.innerHTML = html;
        }

        async function loadSharedWordlist(filename) {
            try {
                var text = await API.wordlists.getContent(filename);
                parseCSVData(text, filename);
                if (window.innerWidth < 768) toggleLibrary();
            } catch(e) {
                showToast('加载失败: ' + e.message, 'error');
            }
        }

        function loadLibraryFile(index) {
            const file = libraryFiles[index];
            if (!file) return;

            // Highlight active item
            document.querySelectorAll('.library-item').forEach((el, i) => {
                el.classList.toggle('active', i === index);
            });

            const reader = new FileReader();
            reader.onload = function (e) {
                // Reset page to 1 when explicitly selecting from library
                // But parseCSVData handles persistence... 
                // We want to treat this as a fresh load.
                parseCSVData(e.target.result, file.name);

                // Close drawer on mobile only
                if (window.innerWidth < 768) {
                    toggleLibrary();
                }
            };
            reader.readAsText(file);
        }
        // --- Daily Practice Stats ---
        function recordDailyPractice(correct, wrong) {
            try {
                API.request('/stats/daily', {
                    method: 'POST',
                    body: JSON.stringify({ words_practiced: correct + wrong, correct_count: correct, wrong_count: wrong })
                }).catch(function() {});
            } catch(e) {}
        }

        async function showStatsDashboard() {
            var overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.cssText = 'display:flex; z-index:99990;';
            overlay.id = 'statsDashboard';
            overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

            var card = document.createElement('div');
            card.className = 'modal-card';
            card.style.cssText = 'width:600px; max-width:95%; max-height:85vh; overflow-y:auto;';
            card.onclick = function(e) { e.stopPropagation(); };

            var title = document.createElement('div');
            title.className = 'modal-title';
            title.textContent = '📊 学习统计';
            card.appendChild(title);

            var loading = document.createElement('p');
            loading.style.cssText = 'text-align:center; padding:20px;';
            loading.textContent = '加载中...';
            card.appendChild(loading);

            var closeBtn = document.createElement('button');
            closeBtn.className = 'btn btn-secondary';
            closeBtn.textContent = '关闭';
            closeBtn.style.cssText = 'display:block; margin:15px auto 0;';
            closeBtn.onclick = function() { overlay.remove(); };
            card.appendChild(closeBtn);

            overlay.appendChild(card);
            document.body.appendChild(overlay);

            try {
                var [dailyRes, statsRes] = await Promise.all([
                    API.request('/stats/daily'),
                    API.request('/stats')
                ]);

                var daily = dailyRes.daily || [];
                var stats = statsRes.stats || [];
                var totalCorrect = stats.reduce(function(s, w) { return s + w.correct; }, 0);
                var totalWrong = stats.reduce(function(s, w) { return s + w.wrong; }, 0);
                var totalWords = stats.length;
                var masteredWords = stats.filter(function(w) { return w.correct >= 3 && w.wrong === 0; }).length;
                var today = new Date().toISOString().slice(0, 10);
                var todayStats = daily.find(function(d) { return d.date === today; }) || { words_practiced: 0, correct_count: 0, wrong_count: 0 };
                var streak = 0;
                for (var i = daily.length - 1; i >= 0; i--) {
                    if (daily[i].words_practiced > 0) streak++;
                    else if (daily[i].date < today) break;
                }

                var html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:15px 0;">';
                html += '<div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:14px; text-align:center;"><div style="font-size:28px; font-weight:bold; color:#007BFF;">' + totalWords + '</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">练习单词</div></div>';
                html += '<div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:14px; text-align:center;"><div style="font-size:28px; font-weight:bold; color:#28a745;">' + masteredWords + '</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">已掌握</div></div>';
                html += '<div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:14px; text-align:center;"><div style="font-size:28px; font-weight:bold; color:#ffc107;">' + streak + '</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">连续打卡</div></div>';
                html += '<div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:14px; text-align:center;"><div style="font-size:28px; font-weight:bold;">' + todayStats.words_practiced + '</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">今日练习</div></div>';
                html += '</div>';
                html += '<div style="margin:10px 0;">✅ 正确: ' + totalCorrect + ' &nbsp;|&nbsp; ❌ 错误: ' + totalWrong + ' &nbsp;|&nbsp; 正确率: ' + (totalCorrect + totalWrong > 0 ? Math.round(totalCorrect / (totalCorrect + totalWrong) * 100) : 0) + '%</div>';

                if (daily.length > 0) {
                    html += '<div style="margin-top:15px; padding-top:15px; border-top:1px solid var(--border-color);"><strong>近7天练习</strong></div>';
                    html += '<div style="margin-top:5px;">';
                    var last7 = daily.slice(-7).reverse();
                    last7.forEach(function(d) {
                        var barW = Math.min(100, d.words_practiced * 5);
                        html += '<div style="display:flex; align-items:center; gap:8px; margin:4px 0; font-size:13px;">';
                        html += '<span style="width:80px; color:var(--text-secondary);">' + d.date.slice(5) + '</span>';
                        html += '<div style="flex:1; background:var(--border-color); border-radius:4px; height:16px;"><div style="background:linear-gradient(90deg,#28a745,#007BFF); height:16px; border-radius:4px; width:' + barW + '%;"></div></div>';
                        html += '<span style="width:40px; text-align:right;">' + d.words_practiced + '</span>';
                        html += '</div>';
                    });
                    html += '</div>';
                }

                loading.innerHTML = html;
            } catch(e) {
                loading.innerHTML = '<p style="text-align:center; color:#dc3545;">加载失败: ' + e.message + '</p>';
            }
        }

        async function hardReset() {
            if (await showConfirm('确定要清除所有缓存并强制刷新吗？\n这将清除本地的学习进度。', '清除刷新', '取消', true)) {
                localStorage.clear();
                window.location.reload(true);
            }
        }
