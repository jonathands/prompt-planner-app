const { ipcRenderer } = require('electron');

class StorageManager {
    constructor() {
        this.saveDirectory = null;
    }

    async initSaveDirectory() {
        try {
            this.saveDirectory = await ipcRenderer.invoke('get-save-directory');
            console.log('Save directory:', this.saveDirectory);
        } catch (error) {
            console.error('Error getting save directory:', error);
            this.saveDirectory = await ipcRenderer.invoke('get-default-save-directory');
        }
        return this.saveDirectory;
    }

    async loadPlans() {
        try {
            const result = await ipcRenderer.invoke('load-plans', this.saveDirectory);

            if (result.success && result.plans) {
                return result.plans;
            } else if (!result.success) {
                console.error('Error loading plans:', result.error);

                // Fallback to localStorage for migration
                const saved = localStorage.getItem('promptPlans');
                if (saved) {
                    const plans = JSON.parse(saved);
                    // Save to file system
                    await this.savePlans(plans);
                    return plans;
                }
            }
            return [];
        } catch (error) {
            console.error('Error loading plans:', error);
            return [];
        }
    }

    async savePlans(plans) {
        try {
            const result = await ipcRenderer.invoke('save-plans', plans, this.saveDirectory);

            if (!result.success) {
                throw new Error(result.error);
            }
            return { success: true };
        } catch (error) {
            console.error('Failed to save plans:', error);
            return { success: false, error: error.message };
        }
    }

    async changeSaveDirectory() {
        try {
            const newDirectory = await ipcRenderer.invoke('choose-directory');

            if (newDirectory) {
                this.saveDirectory = newDirectory;
                await ipcRenderer.invoke('set-save-directory', newDirectory);
                return newDirectory;
            }
            return null;
        } catch (error) {
            console.error('Error changing save directory:', error);
            throw error;
        }
    }

    async resetSaveDirectory() {
        try {
            const defaultDirectory = await ipcRenderer.invoke('get-default-save-directory');
            this.saveDirectory = defaultDirectory;
            await ipcRenderer.invoke('set-save-directory', defaultDirectory);
            return defaultDirectory;
        } catch (error) {
            console.error('Error resetting save directory:', error);
            throw error;
        }
    }

    exportPlans(plans) {
        if (plans.length === 0) {
            alert('No plans to export');
            return false;
        }

        plans.forEach((plan) => {
            const content = this.generateMarkdownForPlan(plan);
            const blob = new Blob([content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.sanitizeFileName(plan.title)}_${plan.id}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        return true;
    }

    importPlans(files, callback) {
        if (!files || files.length === 0) return;

        const importedPlans = [];
        let filesProcessed = 0;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const plan = this.parseMarkdownToPlan(content, file.name);
                if (plan) {
                    importedPlans.push(plan);
                }

                filesProcessed++;
                if (filesProcessed === files.length) {
                    callback(importedPlans);
                }
            };
            reader.readAsText(file);
        });
    }

    generateMarkdownForPlan(plan) {
        let content = `# ${plan.title}\n\n`;
        content += `*Created: ${new Date(plan.createdAt).toLocaleDateString()}*\n\n`;
        content += `*Blocks: ${plan.blocks.length} (${plan.blocks.filter(b => !b.done).length} active)*\n\n`;
        content += `---\n\n`;

        plan.blocks.forEach((block, index) => {
            const status = block.done ? '~~' : '';
            const statusEnd = block.done ? '~~' : '';

            content += `## Block ${index + 1} ${block.done ? '(Completed)' : ''}\n\n`;
            content += `${status}${block.content || '*Empty block*'}${statusEnd}\n\n`;
            content += `---\n\n`;
        });

        return content;
    }

    parseMarkdownToPlan(content, fileName) {
        try {
            const lines = content.split('\n');
            const title = lines[0]?.replace(/^#\s+/, '') || fileName.replace(/\.(md|txt)$/i, '');

            const blocks = [];
            let currentBlock = null;
            let inBlock = false;

            lines.forEach((line, index) => {
                if (index === 0) return; // Skip title line

                if (line.startsWith('## Block')) {
                    if (currentBlock && currentBlock.content.trim()) {
                        blocks.push(currentBlock);
                    }

                    const isDone = line.includes('(Completed)');
                    currentBlock = {
                        id: Date.now().toString() + index,
                        content: '',
                        done: isDone,
                        collapsed: false
                    };
                    inBlock = true;
                } else if (line === '---') {
                    inBlock = false;
                } else if (inBlock && currentBlock && line.trim() !== '') {
                    const cleanLine = line.replace(/^~~|~~$/g, '').trim();
                    if (cleanLine !== '*Empty block*') {
                        currentBlock.content += (currentBlock.content ? '\n' : '') + cleanLine;
                    }
                }
            });

            if (currentBlock && currentBlock.content.trim()) {
                blocks.push(currentBlock);
            }

            if (blocks.length === 0) {
                blocks.push({
                    id: Date.now().toString(),
                    content: content,
                    done: false,
                    collapsed: false
                });
            }

            return {
                id: Date.now().toString(),
                title: title,
                createdAt: new Date().toISOString(),
                blocks: blocks
            };
        } catch (error) {
            console.error('Error parsing markdown:', error);
            return null;
        }
    }

    sanitizeFileName(fileName) {
        return fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    // Settings storage (localStorage)
    loadSettings() {
        const fontSize = localStorage.getItem('promptManagerFontSize');
        const darkMode = localStorage.getItem('promptManagerDarkMode');

        return {
            fontSize: fontSize ? parseInt(fontSize) : 14,
            darkMode: darkMode === 'true'
        };
    }

    saveSettings(fontSize, darkMode) {
        localStorage.setItem('promptManagerFontSize', fontSize.toString());
        localStorage.setItem('promptManagerDarkMode', darkMode.toString());
    }
}

module.exports = StorageManager;
