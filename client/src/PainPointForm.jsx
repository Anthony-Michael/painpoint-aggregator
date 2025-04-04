import React, { useState } from 'react';
import axios from 'axios';

const PainPointForm = ({ onSubmitSuccess }) => {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:3000/painpoints', {
        description
      });

      if (response.data.success) {
        setDescription('');
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } else {
        setError(response.data.message || 'Failed to submit pain point.');
      }
    } catch (err) {
      setError('Error submitting pain point. Please try again later.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="pain-point-form">
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe your business pain point..."
        required
        rows={4}
        disabled={submitting}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Pain Point'}
      </button>
      {error && <div className="form-error">{error}</div>}
    </form>
  );
};

export default PainPointForm;
