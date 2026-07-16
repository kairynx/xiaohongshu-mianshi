const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');

const jobs = new Map();
const emitter = new EventEmitter();

function createJob(keywords, options = {}) {
  const job = {
    id: randomUUID(),
    status: 'pending',
    keywords,
    steps: [],
    result: null,
    error: null,
    type: options.type || 'crawl',
    payload: options.payload ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  emitter.emit('update', id);
}

function addStep(id, step) {
  const job = jobs.get(id);
  if (!job) return;
  job.steps.push({ ...step, time: new Date().toISOString() });
  job.updatedAt = new Date().toISOString();
  emitter.emit('update', id);
}

function listJobs() {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

module.exports = { createJob, getJob, updateJob, addStep, listJobs, emitter };
