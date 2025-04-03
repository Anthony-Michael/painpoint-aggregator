class PainPoint {
  constructor(data) {
    this.id = data.id || null;
    this.description = data.description;
    this.source = data.source || 'manual';
    this.category = data.category || null;
    this.severity = data.severity || 'medium';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.userId = data.userId || null;
    this.status = data.status || 'new';
    this.votes = data.votes || 0;
    this.tags = data.tags || [];
  }

  validate() {
    if (!this.description || typeof this.description !== 'string' || this.description.trim() === '') {
      throw new Error('Pain point description is required');
    }

    // Validate severity is one of the allowed values
    const allowedSeverities = ['low', 'medium', 'high', 'critical'];
    if (!allowedSeverities.includes(this.severity)) {
      throw new Error(`Severity must be one of: ${allowedSeverities.join(', ')}`);
    }

    // Validate status is one of the allowed values
    const allowedStatuses = ['new', 'acknowledged', 'in_progress', 'resolved', 'closed'];
    if (!allowedStatuses.includes(this.status)) {
      throw new Error(`Status must be one of: ${allowedStatuses.join(', ')}`);
    }

    return true;
  }

  toFirestore() {
    return {
      description: this.description,
      source: this.source,
      category: this.category,
      severity: this.severity,
      createdAt: this.createdAt,
      userId: this.userId,
      status: this.status,
      votes: this.votes,
      tags: this.tags
    };
  }

  static fromFirestore(snapshot, id) {
    const data = snapshot.data();
    data.id = id;
    return new PainPoint(data);
  }
}

module.exports = PainPoint;
