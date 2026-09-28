import React from 'react';

export default function About() {
  const members = ['Abhinav Singh', 'Abhay Pratap', 'Aditya Singh', 'Ayush Pandey'];
  const stack = ['ESP32', 'Node.js', 'Express', 'MongoDB', 'Socket.IO', 'React'];
  return <div className="v-view">
    <div className="v-about-hero">
      <p className="eyebrow">ABOUT THE PROJECT</p>
      <h1>IoT-Based Smart Hospital Patient Monitoring System</h1>
      <p>This system continuously monitors patient vital signs using an ESP32 and stores the readings in a backend connected to MongoDB. Deterministic threshold alerts are surfaced through a React dashboard for clinical monitoring.</p>
    </div>
    <section className="v-about-section"><div className="v-section-label"><p className="eyebrow">DEVELOPMENT TEAM</p><h2>Development team</h2></div><div className="v-team-grid">{members.map((member) => <article className="panel v-team-card" key={member}><span className="v-avatar">{member.split(' ').map((part) => part[0]).join('')}</span><strong>{member}</strong></article>)}</div></section>
    <section className="v-about-section"><div className="v-section-label"><p className="eyebrow">TECH STACK</p><h2>Built across connected layers</h2></div><div className="v-chip-row">{stack.map((item) => <span className="v-chip" key={item}>{item}</span>)}</div></section>
    <div className="v-notice">Academic prototype - not a certified medical device.</div>
  </div>;
}
