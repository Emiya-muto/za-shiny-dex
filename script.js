document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    // 允许这些元素不存在
    const totalProgressEl = document.getElementById('total-progress');
    const percentageEl = document.getElementById('percentage');

    // 存储闪光状态：Object { [id: string]: number } 存储已获得的宝可梦ID和数量
    // 示例: { "001": 1, "005": 3 }
    let shinyState = {};
    let grayscaleOnOne = true; // 默认开启

    // 初始化
    init();

    function init() {
        loadState();
        loadConfig();
        render();
        updateStats();

        // 监听配置变化
        const toggle = document.getElementById('toggle-grayscale');
        if (toggle) {
            toggle.checked = grayscaleOnOne;
            toggle.addEventListener('change', (e) => {
                grayscaleOnOne = e.target.checked;
                saveConfig();
                updateAllVisuals();
            });
        }

        // 监听保存图片按钮
        const saveBtn = document.getElementById('save-image-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', handleSaveImage);
        }
    }

    // 从 localStorage 加载状态
    function loadState() {
        const savedState = localStorage.getItem('za_shiny_dex_state');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                // 兼容旧版数据 (Array)
                if (Array.isArray(parsed)) {
                    shinyState = {};
                    parsed.forEach(id => {
                        shinyState[id] = 1;
                    });
                } else if (typeof parsed === 'object' && parsed !== null) {
                    shinyState = parsed;
                }
            } catch (e) {
                console.error('Failed to load state:', e);
                shinyState = {};
            }
        }
    }

    // 保存状态到 localStorage
    function saveState() {
        localStorage.setItem('za_shiny_dex_state', JSON.stringify(shinyState));
    }

    function loadConfig() {
        const saved = localStorage.getItem('za_shiny_dex_config_grayscale');
        if (saved !== null) {
            grayscaleOnOne = saved === 'true';
        }
    }

    function saveConfig() {
        localStorage.setItem('za_shiny_dex_config_grayscale', grayscaleOnOne);
    }

    function updateAllVisuals() {
        const allItems = document.querySelectorAll('.pokemon-item');
        allItems.forEach(item => {
            const id = item.dataset.id;
            const count = shinyState[id] || 0;
            if (count === 1 && grayscaleOnOne) {
                item.classList.add('grayscale');
            } else {
                item.classList.remove('grayscale');
            }
        });
    }

    // 渲染界面
    function render() {
        app.innerHTML = '';

        if (!window.regionsData || !Array.isArray(window.regionsData)) {
            app.innerHTML = '<p style="text-align:center; color:red;">数据加载失败，请检查 data.js</p>';
            return;
        }

        window.regionsData.forEach(region => {
            const regionCard = document.createElement('div');
            regionCard.className = 'region-card';

            // 计算该区域进度
            const totalInRegion = region.pokemons.length;
            const shinyInRegion = region.pokemons.filter(pid => (shinyState[pid] || 0) > 0).length;

            const titleDiv = document.createElement('div');
            titleDiv.className = 'region-title';
            titleDiv.innerHTML = `
                <span>${region.name}</span>
                <span class="progress">${shinyInRegion} / ${totalInRegion}</span>
            `;

            const gridDiv = document.createElement('div');
            gridDiv.className = 'pokemon-grid';

            region.pokemons.forEach(pokemonId => {
                const count = shinyState[pokemonId] || 0;
                const isShiny = count > 0;
                
                const item = document.createElement('div');
                item.className = `pokemon-item ${isShiny ? 'shiny' : ''}`;
                if (isShiny && count === 1 && grayscaleOnOne) {
                    item.classList.add('grayscale');
                }
                item.dataset.id = pokemonId;
                item.title = `ID: ${pokemonId}`;

                const img = document.createElement('img');
                img.className = 'pokemon-img';
                img.src = getImagePath(pokemonId, isShiny);
                img.alt = pokemonId;
                img.loading = 'lazy';

                // 数量角标 (只有 >0 时才显示，所以点击它肯定是有闪光状态)
                const badge = document.createElement('span');
                badge.className = 'count-badge';
                badge.textContent = count;
                
                // 点击角标修改数量
                badge.addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止冒泡，防止触发 item 的 toggleShiny
                    showInput(item, pokemonId);
                });

                item.appendChild(badge);
                item.appendChild(img);

                // 点击图片区域：切换 0/1
                item.addEventListener('click', () => {
                    // 如果存在输入框，不触发切换
                    if (!item.querySelector('.count-input')) {
                        toggleShiny(pokemonId);
                    }
                });

                gridDiv.appendChild(item);
            });

            regionCard.appendChild(titleDiv);
            regionCard.appendChild(gridDiv);
            app.appendChild(regionCard);
        });
    }

    // 获取图片路径
    function getImagePath(id, isShiny) {
        const folder = isShiny ? '头像闪光版' : '头像普通版';
        return `${folder}/tile_${id}.png`;
    }

    // 切换闪光状态 (点击图片区域触发)
    function toggleShiny(id) {
        const currentCount = shinyState[id] || 0;
        
        if (currentCount > 0) {
            // 有 -> 无
            delete shinyState[id];
            updateAllInstances(id, 0);
        } else {
            // 无 -> 有 (默认1个)
            shinyState[id] = 1;
            updateAllInstances(id, 1);
        }

        saveState();
        updateAllRegionProgress();
        updateStats();
    }

    // 显示输入框 (点击数字触发)
    function showInput(itemEl, id) {
        // 清除其他可能存在的输入框
        const existingInput = document.querySelector('.count-input');
        if (existingInput) {
            existingInput.blur(); 
        }

        const currentCount = shinyState[id] || 0;
        
        // 隐藏当前的 badge
        const badge = itemEl.querySelector('.count-badge');
        if (badge) badge.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'count-input';
        input.value = currentCount === 0 ? '' : currentCount;
        input.min = 0;

        // 完成编辑的处理函数
        const finishEdit = () => {
            let val = parseInt(input.value, 10);
            if (isNaN(val) || val < 0) val = 0;

            if (val === 0) {
                delete shinyState[id];
            } else {
                shinyState[id] = val;
            }
            
            saveState();
            
            // 移除 input
            if (input.parentNode) input.parentNode.removeChild(input);
            
            // 更新界面
            updateAllInstances(id, val);
            updateAllRegionProgress();
            updateStats();
        };

        // 监听事件
        input.addEventListener('blur', finishEdit);
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur(); 
            }
            if (e.key === 'Escape') {
                // 取消编辑
                if (input.parentNode) input.parentNode.removeChild(input);
                if (badge) badge.style.display = ''; // 恢复显示
            }
        });

        input.addEventListener('click', (e) => e.stopPropagation());
        
        itemEl.appendChild(input);
        input.focus();
        input.select();
    }
    
    // 更新页面上所有相同ID宝可梦的状态
    function updateAllInstances(id, count) {
        const allItems = document.querySelectorAll(`.pokemon-item[data-id="${id}"]`);
        allItems.forEach(item => {
            const img = item.querySelector('img');
            const badge = item.querySelector('.count-badge');
            
            if (badge) {
                badge.textContent = count;
                badge.style.display = ''; // 清除内联样式
            }

            if (count > 0) {
                item.classList.add('shiny');
                img.src = getImagePath(id, true);
                if (count === 1 && grayscaleOnOne) {
                    item.classList.add('grayscale');
                } else {
                    item.classList.remove('grayscale');
                }
            } else {
                item.classList.remove('shiny', 'grayscale');
                img.src = getImagePath(id, false);
            }
        });
    }

    // 更新所有区域的进度文字
    function updateAllRegionProgress() {
        const cards = document.querySelectorAll('.region-card');
        
        window.regionsData.forEach((region, index) => {
            if (cards[index]) {
                const total = region.pokemons.length;
                const current = region.pokemons.filter(pid => (shinyState[pid] || 0) > 0).length;
                const progressSpan = cards[index].querySelector('.progress');
                if (progressSpan) {
                    progressSpan.textContent = `${current} / ${total}`;
                }
            }
        });
    }

    // 更新全局统计
    function updateStats() {
        let totalTasks = 0;
        let completedTasks = 0;
        let totalShinyCount = 0;

        window.regionsData.forEach(region => {
            totalTasks += region.pokemons.length;
            completedTasks += region.pokemons.filter(pid => (shinyState[pid] || 0) > 0).length;
        });

        Object.values(shinyState).forEach(count => {
            totalShinyCount += count;
        });

        if (totalProgressEl) {
            totalProgressEl.textContent = `${completedTasks} / ${totalTasks}`;
        }
        
        let countEl = document.getElementById('total-count');
        // 只有当 stats-bar 存在时才尝试插入 total-count
        const container = document.querySelector('.stats-bar');
        if (!countEl && container && percentageEl) {
            const div = document.createElement('div');
            div.className = 'stat-item';
            div.innerHTML = `闪光总数: <span id="total-count" class="stat-value">0</span>`;
            container.insertBefore(div, percentageEl.parentNode);
            countEl = document.getElementById('total-count');
        }
        
        if (countEl) {
            countEl.textContent = totalShinyCount;
        }

        if (percentageEl) {
            const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            percentageEl.textContent = `${percentage}%`;
        }
    }

    // 保存图片功能
    function handleSaveImage() {
        const btn = document.getElementById('save-image-btn');
        const originalText = btn ? btn.textContent : '保存为图片';
        
        if (btn) {
            btn.textContent = '生成中...';
            btn.disabled = true;
        }

        // 记录当前滚动位置
        const scrollY = window.scrollY;
        window.scrollTo(0, 0);

        // 临时处理懒加载图片，防止截图空白
        const lazyImages = document.querySelectorAll('img[loading="lazy"]');
        lazyImages.forEach(img => {
            img.dataset.originalLoading = img.loading;
            img.loading = 'eager';
        });

        // 临时处理 stats-bar，去掉 backdrop-filter，因为 dom-to-image 不支持
        // 并且确保它是绝对定位在最底部
        const statsBar = document.querySelector('.stats-bar');
        let originalStatsBarStyle = '';
        if (statsBar) {
            originalStatsBarStyle = statsBar.getAttribute('style') || '';
            
            // 计算应该放置的位置：文档总高度 - 栏高
            // 注意：要在 window.scrollTo(0,0) 之后计算，否则可能受滚动影响（虽然理论上 scrollHeight 不变）
            const totalHeight = document.body.scrollHeight;
            
            statsBar.style.position = 'absolute';
            statsBar.style.top = (totalHeight - statsBar.offsetHeight) + 'px';
            statsBar.style.bottom = 'auto';
            statsBar.style.left = '0';
            statsBar.style.width = '100%';
            statsBar.style.backdropFilter = 'none'; // 禁用特效
            statsBar.style.zIndex = '9999'; // 确保在最上层
        }

        // 临时隐藏 options-bar（包含保存按钮）
        const optionsBar = document.querySelector('.options-bar');
        let originalOptionsBarDisplay = '';
        if (optionsBar) {
            originalOptionsBarDisplay = optionsBar.style.display;
            optionsBar.style.display = 'none';
        }

        // 获取当前可视宽度，确保截图时的布局与用户看到的一致（特别是 Grid 布局）
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        
        // 不再需要 options 配置对象，dom-to-image 参数不同


        // 恢复状态的辅助函数
        const restoreState = () => {
            if (statsBar) {
                // 恢复 style
                if (originalStatsBarStyle) {
                    statsBar.setAttribute('style', originalStatsBarStyle);
                } else {
                    statsBar.removeAttribute('style');
                }
            }
            
            if (optionsBar) {
                optionsBar.style.display = originalOptionsBarDisplay;
            }
            
            // 恢复懒加载
            lazyImages.forEach(img => {
                if (img.dataset.originalLoading) {
                    img.loading = img.dataset.originalLoading;
                    delete img.dataset.originalLoading;
                }
            });

            // 恢复滚动
            window.scrollTo(0, scrollY);

            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };

        // 确保 domtoimage 已加载
        if (typeof domtoimage === 'undefined') {
            alert('组件加载中，请稍后再试');
            restoreState();
            return;
        }
        
        // 稍微延迟一点，确保样式应用和图片加载
        setTimeout(() => {
            // 使用 dom-to-image 替换 html2canvas
            domtoimage.toPng(document.body, {
                bgcolor: '#1a1a1a',
                width: viewportWidth,
                height: document.body.scrollHeight
            })
            .then(function (dataUrl) {
                restoreState();
                try {
                    const link = document.createElement('a');
                    link.download = 'pokemon_shiny_dex_' + new Date().toISOString().slice(0,10) + '.png';
                    link.href = dataUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } catch (e) {
                    console.error('Export error:', e);
                    alert('图片导出失败: ' + e.message);
                }
            })
            .catch(function (error) {
                console.error('Dom-to-image error:', error);
                alert('生成图片出错: ' + error.message);
                restoreState();
            });
        }, 100);
    }
});
