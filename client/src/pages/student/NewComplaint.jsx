import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../lib/supabaseClient';
import { ArrowLeft, Send, AlertCircle } from 'lucide-react';

export default function NewComplaint() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [category, setCategory] = useState('bus');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (subject.trim().length < 3 || subject.trim().length > 120) {
      setErrorMsg('Subject must be between 3 and 120 characters');
      return;
    }

    if (body.trim().length < 10 || body.trim().length > 2000) {
      setErrorMsg('Description must be between 10 and 2000 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          body: body.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit complaint');
      }

      navigate('/complaints');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <button
        type="button"
        className="btn btn-ghost mb-3"
        style={{ paddingLeft: 0 }}
        onClick={() => navigate('/complaints')}
      >
        <ArrowLeft size={18} />
        <span>Back to complaints</span>
      </button>

      <div className="card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '4px' }}>
          File a Complaint
        </h2>
        <p className="text-xs text-muted mb-4">
          Report shuttle delays, driver behavior, route issues, or vehicle maintenance.
        </p>

        {errorMsg && (
          <div className="banner-alert banner-danger" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="complaint-category">Category</label>
            <select
              id="complaint-category"
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="bus">Bus Maintenance & Cleanliness</option>
              <option value="driver">Driver Conduct & Punctuality</option>
              <option value="route">Route Stops & Timetable</option>
              <option value="app">App & Tracking Accuracy</option>
              <option value="other">Other Issues</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="complaint-subject">
              Subject ({subject.length}/120)
            </label>
            <input
              id="complaint-subject"
              type="text"
              className="form-input"
              placeholder="e.g. Bus DL-01-CC-1001 delayed 25 mins at Science Block"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              minLength={3}
              maxLength={120}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="complaint-body">
              Detailed Description ({body.length}/2000)
            </label>
            <textarea
              id="complaint-body"
              className="form-textarea"
              rows={5}
              placeholder="Please provide specifics: time of incident, stop location, vehicle plate, or what occurred..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={10}
              maxLength={2000}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg mt-4"
            disabled={submitting}
          >
            <Send size={18} />
            <span>{submitting ? 'Submitting...' : 'Submit Complaint'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
