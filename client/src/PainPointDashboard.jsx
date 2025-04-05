import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PainPointForm from './PainPointForm';

const PainPointDashboard = () => {
  const [painPoints, setPainPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🔄 Fetch pain points when the component loads
  useEffect(() => {
    refreshPainPoints();
  }, []);

  // ✅ New reusable function (the one you asked about!)
  const refreshPainPoints = () => {
    setLoading(true);
    axios.get('http://localhost:3000/painpoints')
      .then((response) => {
        if (response.data.success) {
          setPainPoints(response.data.data);
        } else {
          setError('Failed to fetch pain points');
        }
      })
      .catch((err) => {
        setError('Error connecting to the server: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  if (loading) {
    return <div className="loading">Loading pain points...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="pain-point-dashboard">
      <h1>Pain Point Dashboard</h1>

      {/* 🆕 Hook up the form to refresh data when it submits */}
      <PainPointForm onSubmitSuccess={refreshPainPoints} />

      {painPoints.length === 0 ? (
        <p>No pain points found.</p>
      ) : (
        <div className="table-container">
          <table className="pain-points-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Industry</th>
                <th>Sentiment</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {[...painPoints]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Sort by date descending
                .map((painPoint) => {
                  // Date formatting logic
                  let formattedDate = '-'; // Default for invalid dates
                  if (painPoint.createdAt) {
                    const date = new Date(painPoint.createdAt);
                    if (!isNaN(date.getTime())) { // Check if date is valid
                      // Use en-CA locale with specific numeric format (DD/MM/YYYY, HH:mm)
                      formattedDate = date.toLocaleString('en-CA', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        hour12: false // Use 24-hour clock
                      });
                    }
                  }

                  return (
                    <tr key={painPoint.id}>
                      <td>{painPoint.description}</td>
                      <td>{(painPoint.industry || 'unknown').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</td>
                      <td>{(painPoint.sentiment || 'neutral').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</td>
                      <td>{formattedDate}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PainPointDashboard;
