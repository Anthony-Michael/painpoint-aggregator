import React from 'react';
import PainPointDashboard from './PainPointDashboard';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Pain Point Aggregator</h1>
        <p className="subtitle">Collect, classify, and review business pain points.</p>
      </header>
      <main>
        <PainPointDashboard />
      </main>
    </div>
  );
}

export default App;
