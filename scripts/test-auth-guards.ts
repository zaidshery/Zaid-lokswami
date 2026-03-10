const { resolveRouteGuardDecision } = require('../lib/auth/routeGuards') as {
  resolveRouteGuardDecision: (input: {
    pathname: string;
    searchParams: URLSearchParams;
    isAuthenticated: boolean;
    role: UserRole | undefined;
    isActive: boolean;
  }) =>
    | { action: 'next' }
    | { action: 'redirect'; location: string; status?: 301 | 302 };
};

type UserRole =
  | 'super_admin'
  | 'admin'
  | 'editor'
  | 'author'
  | 'viewer'
  | 'reader';

type GuardCase = {
  name: string;
  input: {
    pathname: string;
    query?: string;
    isAuthenticated: boolean;
    role?: UserRole;
    isActive?: boolean;
  };
  expected:
    | { action: 'next' }
    | { action: 'redirect'; location: string; status?: 301 | 302 };
};

function runCase(testCase: GuardCase) {
  const decision = resolveRouteGuardDecision({
    pathname: testCase.input.pathname,
    searchParams: new URLSearchParams(testCase.input.query || ''),
    isAuthenticated: testCase.input.isAuthenticated,
    role: testCase.input.role,
    isActive: testCase.input.isActive !== false,
  });

  if (decision.action !== testCase.expected.action) {
    throw new Error(
      `[${testCase.name}] action mismatch: expected ${testCase.expected.action}, got ${decision.action}`
    );
  }

  if (decision.action === 'redirect' && testCase.expected.action === 'redirect') {
    const actualStatus = decision.status ?? 302;
    const expectedStatus = testCase.expected.status ?? 302;

    if (decision.location !== testCase.expected.location) {
      throw new Error(
        `[${testCase.name}] redirect mismatch: expected ${testCase.expected.location}, got ${decision.location}`
      );
    }

    if (actualStatus !== expectedStatus) {
      throw new Error(
        `[${testCase.name}] status mismatch: expected ${expectedStatus}, got ${actualStatus}`
      );
    }
  }
}

const cases: GuardCase[] = [
  {
    name: 'guest -> /admin redirects to signin with redirect target',
    input: {
      pathname: '/admin',
      isAuthenticated: false,
    },
    expected: {
      action: 'redirect',
      location: '/signin?redirect=%2Fadmin',
    },
  },
  {
    name: 'reader session -> /admin blocked',
    input: {
      pathname: '/admin',
      isAuthenticated: true,
      role: 'reader',
      isActive: true,
    },
    expected: {
      action: 'redirect',
      location: '/signin?error=no_admin_access',
    },
  },
  {
    name: 'inactive admin -> /admin blocked',
    input: {
      pathname: '/admin',
      isAuthenticated: true,
      role: 'editor',
      isActive: false,
    },
    expected: {
      action: 'redirect',
      location: '/signin?error=inactive',
    },
  },
  {
    name: 'active admin -> /admin allowed',
    input: {
      pathname: '/admin',
      isAuthenticated: true,
      role: 'super_admin',
      isActive: true,
    },
    expected: {
      action: 'next',
    },
  },
  {
    name: 'authenticated /signin with postAuth marker is allowed',
    input: {
      pathname: '/signin',
      query: 'postAuth=1&redirect=%2Fadmin',
      isAuthenticated: true,
      role: 'super_admin',
      isActive: true,
    },
    expected: {
      action: 'next',
    },
  },
  {
    name: 'guest protected reader route redirects to signin',
    input: {
      pathname: '/main/account',
      isAuthenticated: false,
    },
    expected: {
      action: 'redirect',
      location: '/signin?redirect=%2Fmain%2Faccount',
    },
  },
  {
    name: '/login keeps query and redirects permanently to /signin',
    input: {
      pathname: '/login',
      query: 'redirect=%2Fadmin',
      isAuthenticated: false,
    },
    expected: {
      action: 'redirect',
      location: '/signin?redirect=%2Fadmin',
      status: 301,
    },
  },
];

let failures = 0;
for (const testCase of cases) {
  try {
    runCase(testCase);
    console.log(`PASS: ${testCase.name}`);
  } catch (error) {
    failures += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: ${message}`);
  }
}

if (failures > 0) {
  console.error(`\nAuth guard regression checks failed (${failures}).`);
  process.exit(1);
}

console.log(`\nAuth guard regression checks passed (${cases.length} cases).`);
