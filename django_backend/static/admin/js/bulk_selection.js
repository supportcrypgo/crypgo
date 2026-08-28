/**
 * Bulk Selection JavaScript for Django Admin
 * Provides "Select All", "Select Page", Shift/Ctrl multi-select functionality
 */

(function() {
    'use strict';

    // Initialize bulk selection on admin changelist pages
    function initBulkSelection() {
        const changelistForm = document.getElementById('changelist-form');
        if (!changelistForm) return;

        // Find the action checkbox (Select All)
        const actionCheckbox = document.getElementById('action-toggle');
        if (!actionCheckbox) return;

        const checkboxes = changelistForm.querySelectorAll('input[name="_selected_action"]');
        
        // Track selection state
        let lastCheckedIndex = -1;
        let isShiftDown = false;

        // Shift key handling
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Shift') isShiftDown = true;
        });
        
        document.addEventListener('keyup', function(e) {
            if (e.key === 'Shift') isShiftDown = false;
        });

        // Add click handlers for Shift+Click range selection
        checkboxes.forEach(function(checkbox, index) {
            checkbox.addEventListener('click', function(e) {
                if (isShiftDown && lastCheckedIndex !== -1 && lastCheckedIndex !== index) {
                    e.preventDefault();
                    const start = Math.min(lastCheckedIndex, index);
                    const end = Math.max(lastCheckedIndex, index);
                    
                    for (let i = start; i <= end; i++) {
                        checkboxes[i].checked = checkbox.checked;
                        // Trigger change event for Django admin
                        checkboxes[i].dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    updateActionToggleState();
                }
                lastCheckedIndex = index;
            });
        });

        // Ctrl+A handling for "Select All" on page
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                const activeElement = document.activeElement;
                // Only trigger if we're in the changelist (not in an input field)
                if (activeElement && activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && activeElement.tagName !== 'SELECT') {
                    e.preventDefault();
                    selectAllOnPage();
                }
            }
        });

        // Add "Select All" button to actions dropdown
        enhanceActionDropdown();
        
        // Add "Select Page" functionality
        addSelectPageFeature();
        
        // Add bulk select by filter
        addFilterSelectFeature();
    }

    function updateActionToggleState() {
        const actionToggle = document.getElementById('action-toggle');
        const checkboxes = document.querySelectorAll('input[name="_selected_action"]');
        const checkedCount = Array.from(checkboxes).filter(c => c.checked).length;
        
        if (actionToggle) {
            actionToggle.checked = checkedCount === checkboxes.length && checkboxes.length > 0;
            actionToggle.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
        }
    }

    function selectAllOnPage() {
        const checkboxes = document.querySelectorAll('input[name="_selected_action"]');
        checkboxes.forEach(function(checkbox) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
        updateActionToggleState();
        showNotification('All ' + checkboxes.length + ' items on this page selected');
    }

    function deselectAllOnPage() {
        const checkboxes = document.querySelectorAll('input[name="_selected_action"]');
        checkboxes.forEach(function(checkbox) {
            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
        updateActionToggleState();
        showNotification('Selection cleared');
    }

    function enhanceActionDropdown() {
        const actionSelect = document.querySelector('select[name="action"]');
        if (!actionSelect) return;

        // Add separator and select/deselect options
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.value = '';
        separator.textContent = '──────────';
        actionSelect.appendChild(separator);

        const selectPageOption = document.createElement('option');
        selectPageOption.value = 'select_page';
        selectPageOption.textContent = '✓ Select all on this page';
        actionSelect.appendChild(selectPageOption);

        const deselectPageOption = document.createElement('option');
        deselectPageOption.value = 'deselect_page';
        deselectPageOption.textContent = '✗ Deselect all on this page';
        actionSelect.appendChild(deselectPageOption);

        const selectFilteredOption = document.createElement('option');
        selectFilteredOption.value = 'select_filtered';
        selectFilteredOption.textContent = '✓ Select all matching filter';
        actionSelect.appendChild(selectFilteredOption);

        // Handle custom actions
        actionSelect.addEventListener('change', function() {
            if (this.value === 'select_page') {
                selectAllOnPage();
                this.selectedIndex = 0;
            } else if (this.value === 'deselect_page') {
                deselectAllOnPage();
                this.selectedIndex = 0;
            } else if (this.value === 'select_filtered') {
                selectAllMatchingFilter();
                this.selectedIndex = 0;
            }
        });
    }

    function addSelectPageFeature() {
        // Add keyboard shortcut hint
        const actionCounter = document.querySelector('.action-counter');
        if (actionCounter) {
            const hint = document.createElement('span');
            hint.style.cssText = 'margin-left: 10px; color: #666; font-size: 12px;';
            hint.textContent = 'Tip: Ctrl+A to select page, Shift+Click for range';
            actionCounter.parentNode.appendChild(hint);
        }
    }

    function addFilterSelectFeature() {
        // This would require AJAX to get filtered queryset count
        // For now, just show a note
    }

    function selectAllMatchingFilter() {
        // Show confirmation dialog
        if (!confirm('This will select ALL items matching the current filter (across all pages). Continue?')) {
            return;
        }

        // Get current filter parameters
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('action', 'select_all_filtered');
        
        // Redirect to a special view or use AJAX
        // For now, we'll just select all on current page and show message
        selectAllOnPage();
        showNotification('Selected all on current page. For all pages, use the "Run campaign" action with appropriate filters.', 'info');
    }

    function showNotification(message, type = 'success') {
        // Remove existing notifications
        const existing = document.querySelector('.bulk-select-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'bulk-select-notification';
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            background: ${type === 'error' ? '#dc3545' : type === 'info' ? '#17a2b8' : '#28a745'};
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;
        
        // Add animation style
        if (!document.getElementById('bulk-select-styles')) {
            const style = document.createElement('style');
            style.id = 'bulk-select-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        setTimeout(function() {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(function() { notification.remove(); }, 300);
        }, 3000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBulkSelection);
    } else {
        initBulkSelection();
    }

    // Also re-initialize after Django admin's dynamic content loads
    document.addEventListener('django-admin-form-initialized', initBulkSelection);
})();