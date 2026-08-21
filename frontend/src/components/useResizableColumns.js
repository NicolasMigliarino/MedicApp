import { useEffect, useRef } from 'react';

/**
 * useResizableColumns
 * 
 * Attaches drag-to-resize handles to every <th> inside a <table>.
 * Usage:
 *   const tableRef = useResizableColumns();
 *   <table ref={tableRef}>...</table>
 */
const useResizableColumns = () => {
    const tableRef = useRef(null);

    useEffect(() => {
        const table = tableRef.current;
        if (!table) return;

        // Skip resizing and locking widths on mobile/touch screens (viewport <= 1024px)
        if (window.innerWidth <= 1024) return;

        const headers = Array.from(table.querySelectorAll('thead th'));

        const handles = [];

        headers.forEach(th => {
            // Don't double-add handles on re-render
            if (th.querySelector('.col-resize-handle')) return;

            const handle = document.createElement('div');
            handle.className = 'col-resize-handle';
            th.style.position = 'relative';
            th.style.userSelect = 'none';
            th.appendChild(handle);
            handles.push(handle);

            let startX = 0;
            let startWidth = 0;

            const onMouseDown = (e) => {
                e.preventDefault();

                // Set widths on all headers at the moment drag starts, so resize is stable
                headers.forEach(header => {
                    if (!header.style.width) {
                        header.style.width = `${header.offsetWidth}px`;
                    }
                });

                startX = e.clientX;
                startWidth = th.offsetWidth;
                handle.classList.add('dragging');

                const onMouseMove = (e) => {
                    const diff = e.clientX - startX;
                    const newWidth = Math.max(60, startWidth + diff);
                    th.style.width = `${newWidth}px`;
                };

                const onMouseUp = () => {
                    handle.classList.remove('dragging');
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };

            handle.addEventListener('mousedown', onMouseDown);
        });

        return () => {
            handles.forEach(h => {
                h.removeEventListener('mousedown', () => { });
                if (h.parentNode) h.parentNode.removeChild(h);
            });
        };
    }, []);

    return tableRef;
};

export default useResizableColumns;
