/**
 * Opens styled HTML in a new browser window and triggers the native print dialog.
 * The user can then "Save as PDF" or print to a physical printer.
 * This approach works universally across all hosting platforms (Vercel, Netlify, etc.)
 * without requiring any server-side browser binaries.
 */
export function printHtmlToPDF(html: string): void {
  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (!printWindow) {
    throw new Error('Pop-up blocked. Please allow pop-ups for this site to export PDFs.');
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  let printTriggered = false;
  const triggerPrint = () => {
    if (printTriggered) return;
    printTriggered = true;
    printWindow.focus();
    printWindow.print();
  };

  // Automatically close window after print/cancel completes
  try {
    printWindow.onafterprint = () => {
      try {
        printWindow.close();
      } catch (e) {
        // window already closed
      }
    };
  } catch (e) {
    // onafterprint not supported in this environment
  }

  // Robustly handle onload event (or print immediately if already loaded)
  const checkAndPrint = () => {
    if (printWindow.document.readyState === 'complete') {
      if (printWindow.document.fonts) {
        printWindow.document.fonts.ready.then(() => {
          setTimeout(triggerPrint, 300);
        }).catch(() => {
          setTimeout(triggerPrint, 300);
        });
      } else {
        setTimeout(triggerPrint, 300);
      }
    } else {
      printWindow.onload = () => {
        if (printWindow.document.fonts) {
          printWindow.document.fonts.ready.then(() => {
            setTimeout(triggerPrint, 300);
          }).catch(() => {
            setTimeout(triggerPrint, 300);
          });
        } else {
          setTimeout(triggerPrint, 300);
        }
      };
    }
  };

  checkAndPrint();

  // Bulletproof fallback in case onload or readyState checks fail to trigger
  setTimeout(() => {
    try {
      triggerPrint();
    } catch (e) {
      // Window might already be closed
    }
  }, 1200);
}
