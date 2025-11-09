const { marked } = require('marked');

// StorageManager is loaded via preload.js and available as a global
const StorageManager = window.StorageManager;

class PromptManager {
    constructor() {
        this.plans = [];
        this.currentPlanId = null;
        this.saveTimeout = null;
        this.fontSize = 14;
        this.darkMode = false;
        this.lastEnterPress = 0;
        this.draggedBlock = null;
        this.viewMode = 'source'; // 'source' or 'preview'
        this.blockToDelete = null; // Track block pending deletion confirmation

        this.storage = new StorageManager();
        this.init();
    }

    async init() {
        await this.storage.initSaveDirectory();
        await this.loadPlans();
        this.loadSettings();
        this.setupEventListeners();
        this.setupGlobalEventListeners();
        this.applySettings();
        this.render();
    }

    // Settings Management
    loadSettings() {
        const settings = this.storage.loadSettings();
        this.fontSize = settings.fontSize;
        this.darkMode = settings.darkMode;
    }

    saveSettings() {
        this.storage.saveSettings(this.fontSize, this.darkMode);
    }

    applySettings() {
        document.body.style.fontSize = `${this.fontSize}px`;
        document.getElementById('fontSizeValue').textContent = `${this.fontSize}px`;
        document.getElementById('darkModeToggle').checked = this.darkMode;

        if (this.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    // Plans Management
    async loadPlans() {
        this.plans = await this.storage.loadPlans();
    }

    async savePlans(showStatus = true) {
        if (showStatus) {
            this.showSaveStatus('saving');
        }

        const result = await this.storage.savePlans(this.plans);

        if (result.success && showStatus) {
            setTimeout(() => {
                this.showSaveStatus('saved');
            }, 300);
        } else if (!result.success && showStatus) {
            this.showSaveStatus('error');
        }
    }

    autoSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            this.savePlans(false);
        }, 1000);
    }

    createNewPlan() {
        const newPlan = {
            id: Date.now().toString(),
            title: 'New Prompt Plan',
            createdAt: new Date().toISOString(),
            blocks: [
                {
                    id: Date.now().toString(),
                    content: '',
                    done: false,
                    collapsed: false
                }
            ]
        };

        this.plans.unshift(newPlan);
        this.currentPlanId = newPlan.id;
        this.savePlans();
        this.render();

        setTimeout(() => {
            const titleInput = document.querySelector('.prompt-title');
            if (titleInput) {
                titleInput.focus();
                titleInput.select();
            }
        }, 100);

        this.showToast('Tip: Double tap Enter to add a new block');
    }

    selectPlan(planId) {
        this.currentPlanId = planId;
        this.render();

        setTimeout(() => {
            const blocks = document.querySelectorAll('.block-content');
            if (blocks.length > 0) {
                const lastBlock = blocks[blocks.length - 1];
                lastBlock.focus();

                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(lastBlock);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }, 100);
    }

    closePlan() {
        this.currentPlanId = null;
        this.render();
    }

    toggleViewMode() {
        this.viewMode = this.viewMode === 'source' ? 'preview' : 'source';
        this.updateViewModeButton();
        this.render();
    }

    updateViewModeButton() {
        const viewModeText = document.getElementById('viewModeText');
        if (viewModeText) {
            viewModeText.textContent = this.viewMode === 'source' ? 'Preview' : 'Source';
        }
    }

    deletePlan(planId) {
        const plan = this.plans.find(p => p.id === planId);
        if (plan && confirm(`Delete "${plan.title}"?`)) {
            this.plans = this.plans.filter(p => p.id !== planId);
            if (this.currentPlanId === planId) {
                this.currentPlanId = this.plans.length > 0 ? this.plans[0].id : null;
            }
            this.savePlans();
            this.render();
        }
    }

    duplicatePlan(planId) {
        const originalPlan = this.plans.find(p => p.id === planId);
        if (originalPlan) {
            const duplicatedPlan = {
                id: Date.now().toString(),
                title: `${originalPlan.title} (Copy)`,
                createdAt: new Date().toISOString(),
                blocks: originalPlan.blocks.map(block => ({
                    id: Date.now().toString() + Math.random(),
                    content: block.content,
                    done: block.done,
                    collapsed: block.collapsed
                }))
            };

            this.plans.unshift(duplicatedPlan);
            this.savePlans();
            this.render();
        }
    }

    updatePlanTitle(planId, newTitle) {
        const plan = this.plans.find(p => p.id === planId);
        if (plan) {
            plan.title = newTitle;
            this.autoSave();
        }
    }

    // Block Management
    addBlock(planId) {
        const plan = this.plans.find(p => p.id === planId);
        if (plan) {
            const newBlock = {
                id: Date.now().toString(),
                content: '',
                done: false,
                collapsed: false
            };
            plan.blocks.push(newBlock);
            this.savePlans();
            this.render();

            setTimeout(() => {
                const newBlockElement = document.querySelector(`[data-block-id="${newBlock.id}"] .block-content`);
                if (newBlockElement) {
                    newBlockElement.focus();
                }
            }, 100);
        }
    }

    updateBlock(planId, blockId, content) {
        const plan = this.plans.find(p => p.id === planId);
        if (plan) {
            const block = plan.blocks.find(b => b.id === blockId);
            if (block) {
                block.content = content;
                this.autoSave();
            }
        }
    }

    updateBlockPreview(planId, blockId, content) {
        const block = document.querySelector(`[data-block-id="${blockId}"] .block-preview`);
        if (block) {
            block.innerHTML = content ? marked(content) : '';
        }
    }

    copyBlock(planId, blockId) {
        const plan = this.plans.find(p => p.id === planId);
        if (plan) {
            const block = plan.blocks.find(b => b.id === blockId);
            if (block) {
                navigator.clipboard.writeText(block.content).then(() => {
                    this.showToast('Block content copied to clipboard');
                });
            }
        }
    }

    toggleBlockDone(planId, blockId) {
        const plan = this.plans.find(p => p.id === planId);
        if (plan) {
            const block = plan.blocks.find(b => b.id === blockId);
            if (block) {
                block.done = !block.done;
                this.savePlans(false);
                this.render();
            }
        }
    }

    toggleBlockCollapsed(planId, blockId) {
        const plan = this.plans.find(p => p.id === planId);
        if (plan) {
            const block = plan.blocks.find(b => b.id === blockId);
            if (block) {
                block.collapsed = !block.collapsed;
                this.savePlans(false);
                this.render();
            }
        }
    }

    initiateBlockDelete(planId, blockId) {
        const plan = this.plans.find(p => p.id === planId);
        if (!plan) return;

        if (plan.blocks.length <= 1) {
            this.showToast('Cannot delete the last block');
            return;
        }

        const block = plan.blocks.find(b => b.id === blockId);
        if (!block) return;

        // If block has content, show confirmation
        if (block.content && block.content.trim()) {
            this.blockToDelete = blockId;
            this.render();
        } else {
            // Empty block, delete immediately
            this.confirmBlockDelete(planId, blockId);
        }
    }

    confirmBlockDelete(planId, blockId) {
        const plan = this.plans.find(p => p.id === planId);
        if (plan) {
            plan.blocks = plan.blocks.filter(b => b.id !== blockId);
            this.blockToDelete = null;
            this.savePlans(false);
            this.render();
        }
    }

    cancelBlockDelete() {
        this.blockToDelete = null;
        this.render();
    }

    copyFullPlan(planId) {
        const plan = this.plans.find(p => p.id === planId);
        if (plan) {
            const fullPlanText = plan.blocks
                .map(block => block.content)
                .filter(content => content.trim())
                .join('\n\n---\n\n');

            navigator.clipboard.writeText(fullPlanText).then(() => {
                this.showToast('Full plan copied to clipboard');
            });
        }
    }

    // Import/Export
    async exportPlans() {
        const success = this.storage.exportPlans(this.plans);
        if (success) {
            this.showSaveStatus('saved');
            setTimeout(() => {
                const statusElement = document.getElementById('saveStatus');
                const iconElement = document.getElementById('saveStatusIcon');
                const textElement = document.getElementById('saveStatusText');

                statusElement.className = 'save-status saved';
                iconElement.className = 'ph-download-simple-bold';
                textElement.textContent = 'Exported';
                statusElement.classList.add('show');

                setTimeout(() => {
                    statusElement.classList.remove('show');
                }, 2000);
            }, 100);
        }
    }

    importPlans(files) {
        this.storage.importPlans(files, (importedPlans) => {
            importedPlans.forEach(plan => {
                this.plans.unshift(plan);
            });
            this.savePlans(false);
            this.render();

            document.getElementById('importFileInput').value = '';

            this.showSaveStatus('saved');
            setTimeout(() => {
                const statusElement = document.getElementById('saveStatus');
                const iconElement = document.getElementById('saveStatusIcon');
                const textElement = document.getElementById('saveStatusText');

                statusElement.className = 'save-status saved';
                iconElement.className = 'ph-upload-simple-bold';
                textElement.textContent = 'Imported';
                statusElement.classList.add('show');

                setTimeout(() => {
                    statusElement.classList.remove('show');
                }, 2000);
            }, 100);
        });
    }

    // Directory Management
    async changeSaveDirectory() {
        try {
            const newDirectory = await this.storage.changeSaveDirectory();

            if (newDirectory) {
                await this.savePlans(false);
                this.updateSaveDirectoryDisplay();
                this.showToast(`Save location changed to: ${newDirectory}`);
            }
        } catch (error) {
            console.error('Error changing save directory:', error);
            this.showToast('Error changing save location');
        }
    }

    async resetSaveDirectory() {
        try {
            const defaultDirectory = await this.storage.resetSaveDirectory();
            await this.savePlans(false);
            this.updateSaveDirectoryDisplay();
            this.showToast('Save location reset to default');
        } catch (error) {
            console.error('Error resetting save directory:', error);
            this.showToast('Error resetting save location');
        }
    }

    // UI Methods (moved from separate ui.js concept - keeping them here for simplicity)
    showSaveStatus(status) {
        const statusElement = document.getElementById('saveStatus');
        const iconElement = document.getElementById('saveStatusIcon');
        const textElement = document.getElementById('saveStatusText');

        statusElement.className = `save-status ${status}`;

        switch (status) {
            case 'saving':
                iconElement.className = 'ph-spinner-gap-bold';
                textElement.textContent = 'Saving...';
                break;
            case 'saved':
                iconElement.className = 'ph-check-bold';
                textElement.textContent = 'Saved';
                break;
            case 'error':
                iconElement.className = 'ph-x-bold';
                textElement.textContent = 'Error saving';
                break;
        }

        statusElement.classList.add('show');

        if (status !== 'saving') {
            setTimeout(() => {
                statusElement.classList.remove('show');
            }, 2000);
        }
    }

    showToast(message, duration = 4000) {
        const toastElement = document.getElementById('toast');
        const textElement = document.getElementById('toastText');

        textElement.textContent = message;
        toastElement.classList.add('show');

        setTimeout(() => {
            toastElement.classList.remove('show');
        }, duration);
    }

    openSettingsModal() {
        document.getElementById('settingsModal').classList.add('show');
        this.updateSaveDirectoryDisplay();
    }

    closeSettingsModal() {
        document.getElementById('settingsModal').classList.remove('show');
    }

    updateSaveDirectoryDisplay() {
        const pathElement = document.getElementById('saveDirectoryPath');
        if (pathElement && this.storage.saveDirectory) {
            pathElement.textContent = this.storage.saveDirectory;
        }
    }

    // Rendering (continuing in next part due to length...)
    renderSidebar() {
        const plansList = document.getElementById('plansList');
        if (!plansList) return;

        plansList.innerHTML = '';

        if (this.plans.length === 0) {
            plansList.innerHTML = `
                <div class="empty-plans-message">
                    <button class="empty-plans-add-btn create-first-plan-btn" title="Create Your First Plan">
                        <i class="ph-plus"></i>
                    </button>
                </div>
            `;
            return;
        }

        this.plans.forEach(plan => {
            const planElement = document.createElement('div');
            planElement.className = `plan-item ${plan.id === this.currentPlanId ? 'active' : ''}`;
            const activeBlocks = plan.blocks.filter(b => !b.done).length;
            const totalBlocks = plan.blocks.length;

            planElement.innerHTML = `
                <div class="plan-item-icon">
                    <i class="ph-${plan.id === this.currentPlanId ? 'file-text-bold' : 'file-text'}"></i>
                </div>
                <div class="plan-item-content">
                    <h3 class="plan-item-title" contenteditable="true" data-plan-id="${plan.id}">${plan.title}</h3>
                    <p>${activeBlocks}/${totalBlocks} blocks active</p>
                </div>
                <div class="plan-item-actions">
                    <button class="plan-item-btn duplicate-plan-btn" data-plan-id="${plan.id}" title="Duplicate plan">
                        <i class="ph-copy-simple"></i>
                    </button>
                    <button class="plan-item-btn delete-plan-btn" data-plan-id="${plan.id}" title="Delete plan">
                        <i class="ph-trash"></i>
                    </button>
                </div>
            `;

            const titleElement = planElement.querySelector('.plan-item-title');

            titleElement.addEventListener('blur', (e) => {
                const newTitle = e.target.textContent.trim();
                if (newTitle && newTitle !== plan.title) {
                    this.updatePlanTitle(plan.id, newTitle);
                    this.renderSidebar();
                }
            });

            titleElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();

                    setTimeout(() => {
                        const blocks = document.querySelectorAll('.block-content');
                        if (blocks.length > 0) {
                            const lastBlock = blocks[blocks.length - 1];
                            lastBlock.focus();

                            const range = document.createRange();
                            const selection = window.getSelection();
                            range.selectNodeContents(lastBlock);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    }, 150);
                }
            });

            titleElement.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            planElement.addEventListener('click', (e) => {
                if (!e.target.closest('.plan-item-actions') && !e.target.closest('button') && !e.target.closest('.plan-item-title')) {
                    this.selectPlan(plan.id);
                }
            });

            plansList.appendChild(planElement);
        });
    }

    renderEditor() {
        const editorContainer = document.getElementById('editorContainer');

        if (!this.currentPlanId) {
            editorContainer.innerHTML = `
                <div class="welcome-message">
                    <h3>Welcome to Prompt Manager</h3>
                    <p>Click "New Plan" in the sidebar to create your first prompt plan</p>
                </div>
            `;
            return;
        }

        const plan = this.plans.find(p => p.id === this.currentPlanId);
        if (!plan) return;

        editorContainer.innerHTML = `
            <div class="prompt-editor">
                <input type="text" class="prompt-title" value="${plan.title}"
                       placeholder="Plan Title" data-plan-id="${plan.id}">
                <div class="blocks-container">
                    ${plan.blocks.map(block => this.renderBlock(plan.id, block)).join('')}
                </div>
            </div>
        `;

        this.setupEditorEventListeners();
    }

    renderBlock(planId, block) {
        const previewHtml = block.content ? marked(block.content) : '';
        const firstLine = block.content ? block.content.split('\n')[0] : '';
        const hasMoreContent = block.content && block.content.includes('\n');
        const isDeletePending = this.blockToDelete === block.id;

        return `
            <div class="block ${block.done ? 'done' : ''} ${block.collapsed ? 'collapsed' : ''} ${isDeletePending ? 'delete-pending' : ''}"
                 data-block-id="${block.id}">
                <div class="block-actions-left">
                    <button class="block-btn drag-handle" data-plan-id="${planId}"
                            data-block-id="${block.id}" title="Drag to reorder" draggable="true">
                        <i class="ph-dots-six"></i>
                    </button>
                    <button class="block-btn copy-btn" data-plan-id="${planId}"
                            data-block-id="${block.id}" title="Copy">
                        <i class="ph-copy"></i>
                    </button>
                    <button class="block-btn collapse-btn" data-plan-id="${planId}"
                            data-block-id="${block.id}" title="${block.collapsed ? 'Expand' : 'Collapse'}">
                        <i class="ph-${block.collapsed ? 'caret-down' : 'caret-up'}"></i>
                    </button>
                    ${isDeletePending ? `
                        <button class="block-btn delete-cancel-btn" data-plan-id="${planId}"
                                data-block-id="${block.id}" title="Cancel">
                            <i class="ph-x"></i>
                        </button>
                        <button class="block-btn delete-confirm-btn" data-plan-id="${planId}"
                                data-block-id="${block.id}" title="Confirm Delete">
                            <i class="ph-check"></i>
                        </button>
                    ` : `
                        <button class="block-btn delete-btn" data-plan-id="${planId}"
                                data-block-id="${block.id}" title="Delete">
                            <i class="ph-trash"></i>
                        </button>
                    `}
                </div>
                <button class="block-done-btn" data-plan-id="${planId}"
                        data-block-id="${block.id}" title="${block.done ? 'Mark as undone' : 'Mark as done'}">
                    <i class="ph-${block.done ? 'check-circle' : 'circle'}"></i>
                </button>
                ${block.collapsed ? `
                    <div class="block-preview-collapsed">
                        ${firstLine}${hasMoreContent ? '...' : ''}
                    </div>
                ` : this.viewMode === 'source' ? `
                    <div class="block-content" contenteditable="true"
                         data-plan-id="${planId}" data-block-id="${block.id}"
                         placeholder="Start typing your prompt here...">${block.content}</div>
                ` : `
                    <div class="block-preview markdown-preview"
                         data-plan-id="${planId}" data-block-id="${block.id}">
                        ${previewHtml || '<span style="color: var(--gray-400);">No content</span>'}
                    </div>
                `}
            </div>
        `;
    }

    render() {
        this.renderSidebar();
        this.renderEditor();

        const floatingActionBar = document.getElementById('floatingActionBar');
        if (floatingActionBar) {
            if (this.currentPlanId) {
                floatingActionBar.style.display = 'flex';
            } else {
                floatingActionBar.style.display = 'none';
            }
        }
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.block:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Event Listeners (continuing below...)
    setupEventListeners() {
        document.getElementById('newPlanBtn').addEventListener('click', () => {
            this.createNewPlan();
        });

        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });

        document.getElementById('closeModalBtn').addEventListener('click', () => {
            this.closeSettingsModal();
        });

        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.closeSettingsModal();
            }
        });

        document.getElementById('darkModeToggle').addEventListener('change', (e) => {
            this.darkMode = e.target.checked;
            this.saveSettings();
            this.applySettings();
        });

        document.getElementById('fontDecreaseBtn').addEventListener('click', () => {
            if (this.fontSize > 10) {
                this.fontSize -= 1;
                this.saveSettings();
                this.applySettings();
            }
        });

        document.getElementById('fontIncreaseBtn').addEventListener('click', () => {
            if (this.fontSize < 20) {
                this.fontSize += 1;
                this.saveSettings();
                this.applySettings();
            }
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportPlans();
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });

        document.getElementById('importFileInput').addEventListener('change', (e) => {
            this.importPlans(e.target.files);
        });

        document.getElementById('changeSaveDirectoryBtn').addEventListener('click', async () => {
            await this.changeSaveDirectory();
        });

        document.getElementById('resetSaveDirectoryBtn').addEventListener('click', async () => {
            await this.resetSaveDirectory();
        });
    }

    setupGlobalEventListeners() {
        document.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.copy-btn');
            if (copyBtn) {
                this.copyBlock(copyBtn.dataset.planId, copyBtn.dataset.blockId);
                return;
            }

            const collapseBtn = e.target.closest('.collapse-btn');
            if (collapseBtn) {
                this.toggleBlockCollapsed(collapseBtn.dataset.planId, collapseBtn.dataset.blockId);
                return;
            }

            const collapsedPreview = e.target.closest('.block-preview-collapsed');
            if (collapsedPreview) {
                const block = collapsedPreview.closest('.block');
                if (block) {
                    const blockId = block.dataset.blockId;
                    const planId = this.currentPlanId;
                    this.toggleBlockCollapsed(planId, blockId);
                }
                return;
            }

            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                this.initiateBlockDelete(deleteBtn.dataset.planId, deleteBtn.dataset.blockId);
                return;
            }

            const deleteConfirmBtn = e.target.closest('.delete-confirm-btn');
            if (deleteConfirmBtn) {
                this.confirmBlockDelete(deleteConfirmBtn.dataset.planId, deleteConfirmBtn.dataset.blockId);
                return;
            }

            const deleteCancelBtn = e.target.closest('.delete-cancel-btn');
            if (deleteCancelBtn) {
                this.cancelBlockDelete();
                return;
            }

            const doneBtn = e.target.closest('.block-done-btn');
            if (doneBtn) {
                this.toggleBlockDone(doneBtn.dataset.planId, doneBtn.dataset.blockId);
                return;
            }

            const deletePlanBtn = e.target.closest('.delete-plan-btn');
            if (deletePlanBtn) {
                e.stopPropagation();
                this.deletePlan(deletePlanBtn.dataset.planId);
                return;
            }

            const duplicatePlanBtn = e.target.closest('.duplicate-plan-btn');
            if (duplicatePlanBtn) {
                e.stopPropagation();
                this.duplicatePlan(duplicatePlanBtn.dataset.planId);
                return;
            }

            const copyFullPlanBtn = e.target.closest('.copy-full-plan-btn');
            if (copyFullPlanBtn) {
                this.copyFullPlan(this.currentPlanId);
                return;
            }

            const addBlockBtn = e.target.closest('.add-block-btn');
            if (addBlockBtn) {
                this.addBlock(this.currentPlanId);
                return;
            }

            const createFirstPlanBtn = e.target.closest('.create-first-plan-btn');
            if (createFirstPlanBtn) {
                this.createNewPlan();
                return;
            }

            const closePlanBtn = e.target.closest('.close-plan-btn');
            if (closePlanBtn) {
                this.closePlan();
                return;
            }

            const toggleViewBtn = e.target.closest('.toggle-view-btn');
            if (toggleViewBtn) {
                this.toggleViewMode();
                return;
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('block-content')) {
                this.updateBlock(e.target.dataset.planId, e.target.dataset.blockId, e.target.textContent);
                this.updateBlockPreview(e.target.dataset.planId, e.target.dataset.blockId, e.target.textContent);
            }
        });

        document.addEventListener('paste', (e) => {
            if (e.target.classList.contains('block-content')) {
                const pastedText = e.clipboardData.getData('text/plain');

                // Check if pasted text contains markdown separators
                if (pastedText.includes('\n---\n') || pastedText.includes('\r\n---\r\n')) {
                    e.preventDefault();

                    const planId = e.target.dataset.planId;
                    const currentBlockId = e.target.dataset.blockId;
                    const plan = this.plans.find(p => p.id === planId);
                    if (!plan) return;

                    const currentBlockIndex = plan.blocks.findIndex(b => b.id === currentBlockId);
                    if (currentBlockIndex === -1) return;

                    // Split pasted content by --- separator
                    const sections = pastedText.split(/\r?\n---\r?\n/);

                    // Update current block with first section
                    const currentBlock = plan.blocks[currentBlockIndex];
                    currentBlock.content = sections[0].trim();
                    e.target.textContent = sections[0].trim();
                    this.updateBlock(planId, currentBlockId, sections[0].trim());

                    // Create new blocks for remaining sections
                    for (let i = 1; i < sections.length; i++) {
                        const newBlock = {
                            id: Date.now().toString() + i,
                            content: sections[i].trim(),
                            done: false,
                            collapsed: false
                        };
                        plan.blocks.splice(currentBlockIndex + i, 0, newBlock);
                    }

                    this.savePlans();
                    this.render();

                    // Focus the last created block
                    if (sections.length > 1) {
                        setTimeout(() => {
                            const lastBlockId = plan.blocks[currentBlockIndex + sections.length - 1].id;
                            const lastBlockElement = document.querySelector(`[data-block-id="${lastBlockId}"] .block-content`);
                            if (lastBlockElement) {
                                lastBlockElement.focus();
                            }
                        }, 100);
                    }
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('block-content')) {
                const currentBlockId = e.target.dataset.blockId;
                const planId = e.target.dataset.planId;
                const plan = this.plans.find(p => p.id === planId);
                if (!plan) return;

                const currentBlockIndex = plan.blocks.findIndex(b => b.id === currentBlockId);

                if (e.key === 'Enter') {
                    e.preventDefault();

                    const currentTime = Date.now();
                    const timeSinceLastEnter = currentTime - this.lastEnterPress;

                    if (timeSinceLastEnter < 500 && timeSinceLastEnter > 0) {
                        const selection = window.getSelection();
                        const range = selection.getRangeAt(0);
                        const textContent = e.target.textContent;
                        const cursorPos = range.startOffset;

                        const beforeCursor = textContent.substring(0, cursorPos);
                        const afterCursor = textContent.substring(cursorPos);

                        e.target.textContent = beforeCursor;
                        this.updateBlock(planId, currentBlockId, beforeCursor);

                        const newBlock = {
                            id: Date.now().toString(),
                            content: afterCursor,
                            done: false,
                            collapsed: false
                        };
                        plan.blocks.splice(currentBlockIndex + 1, 0, newBlock);
                        this.savePlans();
                        this.render();

                        this.lastEnterPress = 0;

                        setTimeout(() => {
                            const newBlockElement = document.querySelector(`[data-block-id="${newBlock.id}"] .block-content`);
                            if (newBlockElement) {
                                newBlockElement.focus();
                                const range = document.createRange();
                                const selection = window.getSelection();
                                range.selectNodeContents(newBlockElement);
                                range.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(range);
                            }
                        }, 100);
                    } else {
                        document.execCommand('insertText', false, '\n');
                        this.lastEnterPress = currentTime;
                    }
                } else if (e.key === 'Backspace') {
                    const textContent = e.target.textContent.trim();

                    if (textContent === '' && currentBlockIndex > 0) {
                        e.preventDefault();
                        const previousBlock = plan.blocks[currentBlockIndex - 1];
                        plan.blocks = plan.blocks.filter(b => b.id !== currentBlockId);
                        this.savePlans(false);
                        this.render();

                        setTimeout(() => {
                            const prevBlockElement = document.querySelector(`[data-block-id="${previousBlock.id}"] .block-content`);
                            if (prevBlockElement) {
                                prevBlockElement.focus();
                                const range = document.createRange();
                                const selection = window.getSelection();
                                range.selectNodeContents(prevBlockElement);
                                range.collapse(false);
                                selection.removeAllRanges();
                                selection.addRange(range);
                            }
                        }, 100);
                    }
                }
            }
        });

        // Drag and drop
        document.addEventListener('dragstart', (e) => {
            const dragHandle = e.target.closest('.drag-handle');
            if (!dragHandle) {
                e.preventDefault();
                return;
            }

            const block = e.target.closest('.block');
            if (block) {
                this.draggedBlock = block;
                block.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', block.innerHTML);
            }
        });

        document.addEventListener('dragend', (e) => {
            const block = e.target.closest('.block');
            if (block) {
                block.classList.remove('dragging');
                this.draggedBlock = null;
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            const block = e.target.closest('.block');
            if (block && this.draggedBlock && block !== this.draggedBlock) {
                const container = block.parentElement;
                const afterElement = this.getDragAfterElement(container, e.clientY);

                if (afterElement == null) {
                    container.appendChild(this.draggedBlock);
                } else {
                    container.insertBefore(this.draggedBlock, afterElement);
                }
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedBlock) {
                const planId = this.currentPlanId;
                const plan = this.plans.find(p => p.id === planId);
                if (plan) {
                    const blockElements = Array.from(document.querySelectorAll('.block'));
                    const newOrder = blockElements.map(el => el.dataset.blockId);

                    plan.blocks.sort((a, b) => {
                        return newOrder.indexOf(a.id) - newOrder.indexOf(b.id);
                    });

                    this.savePlans(false);
                }
            }
        });
    }

    setupEditorEventListeners() {
        const titleInput = document.querySelector('.prompt-title');
        if (titleInput) {
            titleInput.addEventListener('input', (e) => {
                this.updatePlanTitle(e.target.dataset.planId, e.target.value);
                this.renderSidebar();
            });

            titleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();

                    setTimeout(() => {
                        const blocks = document.querySelectorAll('.block-content');
                        if (blocks.length > 0) {
                            const lastBlock = blocks[blocks.length - 1];
                            lastBlock.focus();

                            const range = document.createRange();
                            const selection = window.getSelection();
                            range.selectNodeContents(lastBlock);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    }, 100);
                }
            });
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PromptManager();
});
