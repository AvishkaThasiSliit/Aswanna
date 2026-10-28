import React from 'react';

export default function Footer() {
  return (
    <footer style={{
      padding: '20px 32px',
      borderTop: '1px solid #e2e8f0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '12px',
      color: '#94a3b8'
    }}>
      <div>
        <strong>Aswenna</strong> | Agricultural Decision Support System
      </div>
      <div>
        Data • Analytics • Better Farming
      </div>
    </footer>
  );
}
