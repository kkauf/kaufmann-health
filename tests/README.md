# Testing Implementation Guide

## Critical Flow Tests

These are the business-critical paths that must work before any deployment.

### 1. Patient Registration Flow

```typescript
// tests/patient-registration.test.ts
describe('Patient Registration', () => {
  it('completes full signup flow', async () => {
    // Submit form with patient data
    const response = await submitPatientForm({
      email: 'patient@example.com',
      name: 'Test Patient',
      city: 'Berlin',
      issue: 'Trauma-Begleitung'
    });
    
    // Verify success response
    expect(response.status).toBe(200);
    
    // Verify database record created
    expect(mockInserts.people).toHaveLength(1);
    expect(mockInserts.people[0].email).toBe('patient@example.com');
    
    // Verify confirmation emails sent
    expect(mockEmails).toHaveLength(2);
    expect(mockEmails[0].to).toBe('patient@example.com');
    expect(mockEmails[1].to).toBe(process.env.LEADS_NOTIFY_EMAIL);
    
    // Verify analytics event tracked
    expect(mockEvents).toContainEqual(
      expect.objectContaining({ type: 'lead_submitted' })
    );
  });
});
```

### 2. Therapist Registration Flow

```typescript
// tests/therapist-registration.test.ts
describe('Therapist Registration', () => {
  it('binds contract and sends welcome', async () => {
    // Submit therapist application
    const response = await submitTherapistForm({
      email: 'therapist@example.com',
      name: 'Dr. Test',
      specializations: ['narm', 'somatic-experiencing']
    });
    
    // Verify contract binding
    expect(mockInserts.therapist_contracts).toHaveLength(1);
    expect(mockInserts.therapist_contracts[0].contract_version).toBe('v1.0');
    
    // Verify welcome email sent
    expect(mockEmails.some(e => 
      e.to === 'therapist@example.com' && 
      e.subject.includes('Willkommen')
    )).toBe(true);
    
    // Verify searchable in admin
    expect(mockInserts.therapist_profiles[0].searchable).toBe(true);
  });
});
```

### 3. Manual Matching Workflow

```typescript
// tests/manual-matching.test.ts
describe('Manual Matching', () => {
  it('tracks outreach and responses', async () => {
    // Create match
    const match = await createMatch({
      patient_id: 'patient-uuid',
      therapist_id: 'therapist-uuid',
      admin_notes: 'Good fit based on specialization'
    });
    
    // Record outreach
    await recordOutreach(match.id, {
      method: 'email',
      message: 'Introduction email sent'
    });
    
    // Verify outreach tracked
    expect(mockInserts.match_outreach).toHaveLength(1);
    
    // Record response
    await recordResponse(match.id, {
      therapist_response: 'accepted',
      availability: 'Next week'
    });
    
    // Verify match status updated
    expect(mockUpdates.matches[0].status).toBe('accepted');
  });
});
```

---

## Mock Patterns

### Email Mocking

```typescript
// tests/helpers/mocks.ts
export const mockEmails: any[] = [];

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn().mockImplementation(async (params) => {
    mockEmails.push(params);
    return { id: `mock-email-${mockEmails.length}` };
  })
}));

// Clear between tests
beforeEach(() => {
  mockEmails.length = 0;
});
```

### Database Mocking

```typescript
// tests/helpers/mocks.ts
export const mockInserts: Record<string, any[]> = {
  people: [],
  therapist_profiles: [],
  therapist_contracts: [],
  matches: [],
  match_outreach: []
};

export const mockUpdates: Record<string, any[]> = {
  matches: []
};

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn((table) => ({
      insert: vi.fn().mockImplementation((data) => {
        mockInserts[table] = mockInserts[table] || [];
        mockInserts[table].push(data);
        return { 
          data: [{ id: `mock-${table}-${mockInserts[table].length}` }], 
          error: null 
        };
      }),
      update: vi.fn().mockImplementation((data) => {
        mockUpdates[table] = mockUpdates[table] || [];
        mockUpdates[table].push(data);
        return { data: [data], error: null };
      })
    }))
  }
}));

// Clear between tests
beforeEach(() => {
  Object.keys(mockInserts).forEach(key => mockInserts[key].length = 0);
  Object.keys(mockUpdates).forEach(key => mockUpdates[key].length = 0);
});
```

### Analytics Mocking

```typescript
// tests/helpers/mocks.ts
export const mockEvents: any[] = [];

vi.mock('@/lib/analytics', () => ({
  track: vi.fn().mockImplementation(async (event) => {
    mockEvents.push(event);
    return { success: true };
  })
}));

// Clear between tests
beforeEach(() => {
  mockEvents.length = 0;
});
```

---

## Running Tests

### Commands

```bash
# Run all critical flow tests (before deploy)
npm run test:critical

# Run specific test file
npm test tests/patient-registration.test.ts

# Run with coverage report
npm test -- --coverage

# Run in watch mode during development
npm test -- --watch

# Run with verbose output for debugging
npm test -- --reporter=verbose
```

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:critical": "vitest tests/*registration*.test.ts tests/*matching*.test.ts",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  }
}
```

---

## Test-Driven Refactoring Process

### 1. Document Current Behavior

```typescript
describe('Before Refactor - Baseline', () => {
  it('documents current email behavior', async () => {
    const result = await currentEmailFlow();
    
    // Capture EXACT current behavior
    expect(result.emailsSent).toBe(2);
    expect(result.emailTypes).toEqual(['confirmation', 'admin_notify']);
    
    // Save snapshot for comparison
    expect(result).toMatchSnapshot();
  });
});
```

### 2. Refactor With Safety

```typescript
describe('After Refactor - Verification', () => {
  it('maintains same behavior', async () => {
    const result = await refactoredEmailFlow();
    
    // Should match baseline exactly
    expect(result.emailsSent).toBe(2);
    expect(result.emailTypes).toEqual(['confirmation', 'admin_notify']);
    
    // Compare with snapshot
    expect(result).toMatchSnapshot();
  });
});
```

### 3. Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh

echo "🏥 Running critical flow tests..."

npm run test:critical || {
  echo "❌ Critical tests failed!"
  exit 1
}

echo "✅ All critical flows operational"
echo "📊 Coverage report: coverage/index.html"
```

---

## Testing Principles

1. **Test User Outcomes, Not Implementation**
   - ❌ "Database field updated"
   - ✅ "User receives confirmation email"

2. **Tests as Living Documentation**
   - Each test explains what the system does
   - New developers understand by reading tests

3. **Mock External Dependencies**
   - Email services
   - Database operations
   - Third-party APIs

4. **Fast Feedback Loop**
   - Critical tests run in <10 seconds
   - Use watch mode during development

5. **Regression Prevention**
   - Any bug becomes a test case
   - Tests prevent re-introducing bugs

---

## Common Test Scenarios

### Form Validation

```typescript
it('rejects invalid email addresses', async () => {
  const response = await submitPatientForm({
    email: 'not-an-email',
    name: 'Test User'
  });
  
  expect(response.status).toBe(400);
  expect(response.error).toContain('email');
});
```

### Rate Limiting

```typescript
it('prevents rapid submissions', async () => {
  // First request succeeds
  const first = await submitForm(validData);
  expect(first.status).toBe(200);
  
  // Immediate second request blocked
  const second = await submitForm(validData);
  expect(second.status).toBe(429);
});
```

### Error Recovery

```typescript
it('logs error when email fails but still saves data', async () => {
  // Mock email failure
  vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Email service down'));
  
  const response = await submitForm(validData);
  
  // User operation succeeds
  expect(response.status).toBe(200);
  
  // Error was logged
  expect(mockEvents).toContainEqual(
    expect.objectContaining({ 
      type: 'error',
      source: 'email'
    })
  );
});
```