import React from 'react';

export default function Footer() {
  return (
    <footer
      className="team-footer"
      style={{
        width: '100%',
        display: 'block',
        marginTop: 0,
        padding: '12px 18px',
        textAlign: 'center',
        color: '#8a9994',
        background: '#f4f7f4',
        fontSize: '12px'
      }}
    >
      <p>IoT-Based Smart Hospital Patient Monitoring System</p>
      <p style={{ marginTop: '4px' }}>
        Developed by: Abhinav Singh, Abhay Pratap, Aditya Singh, Ayush Pandey
      </p>
    </footer>
  );
}
