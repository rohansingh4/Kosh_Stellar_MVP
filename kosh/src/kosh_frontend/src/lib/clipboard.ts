/**
 * Utility function for copying text to clipboard with fallback methods
 * Handles permissions policy violations and provides alternative copy methods
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  // Method 1: Try modern Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API failed:', error);
      // Fall through to legacy methods
    }
  }

  // Method 2: Legacy execCommand method
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      return true;
    }
  } catch (error) {
    console.warn('execCommand copy failed:', error);
  }

  // Method 3: Manual selection for user to copy
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'absolute';
    textArea.style.left = '50%';
    textArea.style.top = '50%';
    textArea.style.transform = 'translate(-50%, -50%)';
    textArea.style.width = '300px';
    textArea.style.height = '100px';
    textArea.style.zIndex = '9999';
    textArea.style.backgroundColor = 'white';
    textArea.style.color = 'black';
    textArea.style.border = '2px solid #333';
    textArea.style.borderRadius = '8px';
    textArea.style.padding = '10px';
    textArea.readOnly = true;
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    // Show instruction to user
    const instruction = document.createElement('div');
    instruction.innerHTML = 'Press Ctrl+C (or Cmd+C) to copy, then click anywhere to close';
    instruction.style.position = 'absolute';
    instruction.style.left = '50%';
    instruction.style.top = '40%';
    instruction.style.transform = 'translate(-50%, -50%)';
    instruction.style.backgroundColor = '#333';
    instruction.style.color = 'white';
    instruction.style.padding = '10px';
    instruction.style.borderRadius = '4px';
    instruction.style.zIndex = '10000';
    instruction.style.fontSize = '14px';
    
    document.body.appendChild(instruction);
    
    // Clean up when user clicks anywhere
    const cleanup = () => {
      document.body.removeChild(textArea);
      document.body.removeChild(instruction);
      document.removeEventListener('click', cleanup);
      document.removeEventListener('keydown', keyHandler);
    };
    
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', cleanup);
      document.addEventListener('keydown', keyHandler);
    }, 100);
    
    return true; // We provided a way for user to copy
  } catch (error) {
    console.error('All copy methods failed:', error);
    return false;
  }
};