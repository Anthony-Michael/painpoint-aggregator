import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Define API URL based on environment
const API_URL = import.meta.env.PROD 
  ? 'https://painpointinsightai.onrender.com'  // Production backend
  : 'http://localhost:3000';  // Development backend

const API_ENDPOINT = `${API_URL}/api/painpoints`;

const PainPointForm = ({ onSubmitSuccess }) => {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [status, setStatus] = useState('idle');
  const [email, setEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState('idle');
  const [waitlistMessage, setWaitlistMessage] = useState('');

  useEffect(() => {
    setAnalysisResult(null);
    setStatus('idle');
    setError(null);
  }, [description]);

  useEffect(() => {
    let timer;
    if (status === 'success') {
      timer = setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setStatus('submitting');
    setError(null);
    setAnalysisResult(null);

    try {
      const response = await axios.post(API_ENDPOINT, {
        description
      });

      if (response.data.success) {
        setAnalysisResult(response.data.data);
        setDescription('');
        setStatus('success');
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } else {
        setError(response.data.message || 'Analysis failed.');
        setStatus('error');
      }
    } catch (err) {
      if (err.response && err.response.status === 429) {
        setError('Rate limit exceeded. Please try again later.');
      } else {
        setError('Error during analysis. Please try again later.');
      }
      setStatus('error');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWaitlistSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setWaitlistStatus('submitting');
    setWaitlistMessage('');

    try {
      const response = await axios.post(`${API_URL}/api/waitlist`, { email });
      
      if (response.status === 201) {
        setWaitlistStatus('success');
        setWaitlistMessage('Thanks for joining! We\'ll be in touch.');
        setEmail('');
      } else {
        setWaitlistStatus('error');
        setWaitlistMessage(response.data.message || 'Signup failed.');
      }
    } catch (err) {
      setWaitlistStatus('error');
      if (err.response && err.response.data && err.response.data.message) {
        setWaitlistMessage(err.response.data.message);
      } else if (err.response && err.response.status === 429) {
        setWaitlistMessage('Rate limit exceeded. Please try again later.');
      } else {
        setWaitlistMessage('An error occurred during signup.');
      }
      console.error(err);
    }
  };

  return (
    <div className="pain-point-form-container">
      <form onSubmit={handleSubmit} className="pain-point-form">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter a business pain point to analyze..."
          required
          rows={4}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting || !description.trim()}>
          {status === 'submitting' ? 'Analyzing...' : 'Analyze Pain Point'}
        </button>
      </form>

      <div className="analysis-feedback">
        {status === 'success' && analysisResult && (
          <div className="form-result form-success fade-in">
            <strong>Analysis Result:</strong>
            <ul>
              <li><strong>Industry:</strong> {analysisResult.industry}</li>
              <li><strong>Sentiment:</strong> {analysisResult.sentiment}</li>
              <li><strong>Confidence:</strong> {analysisResult.confidenceScore}%</li>
              {analysisResult.confidenceExplanation && 
                <li><strong>Reasoning:</strong> {analysisResult.confidenceExplanation}</li>
              }
            </ul>
          </div>
        )}
        {status === 'error' && (
          <div className="form-result form-error fade-in">
            {error || 'An unexpected error occurred.'}
          </div>
        )}
      </div>

      {status === 'success' && analysisResult && (
        <div className="waitlist-cta fade-in">
          <h3>Want more insights like this?</h3>
          <p>Enter your email to get early access to the full platform.</p>
          
          {waitlistStatus !== 'success' ? (
            <form onSubmit={handleWaitlistSubmit} className="waitlist-form">
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={waitlistStatus === 'submitting'}
              />
              <button type="submit" disabled={waitlistStatus === 'submitting' || !email.trim()}>
                {waitlistStatus === 'submitting' ? 'Joining...' : 'Join Waitlist'}
              </button>
            </form>
          ) : null} 

          {waitlistMessage && (
            <div className={`waitlist-message ${waitlistStatus === 'success' ? 'success' : 'error'} fade-in`}>
              {waitlistMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PainPointForm;