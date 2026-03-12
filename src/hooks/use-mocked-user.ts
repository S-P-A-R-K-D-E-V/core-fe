import { _mock } from 'src/_mock';
import { useAuthContext } from 'src/auth/hooks';

// TO GET THE USER FROM THE AUTHCONTEXT, YOU CAN USE

// CHANGE:
// import { useMockedUser } from 'src/hooks/use-mocked-user';
// const { user } = useMockedUser();

// TO:
// import { useAuthContext } from 'src/auth/hooks';
// const { user } = useAuthContext();

// ----------------------------------------------------------------------

export function useMockedUser() {
  const auth = useAuthContext();

  // If user is authenticated, use real user data
  if (auth.user) {
    return {
      user: {
        id: auth.user.id,
        displayName: auth.user.displayName || `${auth.user.firstName || ''} ${auth.user.lastName || ''}`.trim() || 'User',
        email: auth.user.email || '',
        password: '',
        photoURL: auth.user.photoURL || _mock.image.avatar(24),
        phoneNumber: auth.user.phoneNumber || '',
        country: '',
        address: '',
        state: '',
        city: '',
        zipCode: '',
        about: '',
        role: auth.user.role || 'User',
        roles: auth.user.roles || [],
        permissions: auth.user.permissions || [],
        isPublic: true,
      },
    };
  }

  // Fallback to mock data (for unauthenticated/demo)
  const user = {
    id: '8864c717-587d-472a-929a-8e5f298024da-0',
    displayName: 'Jaydon Frankie',
    email: 'demo@minimals.cc',
    password: 'demo1234',
    photoURL: _mock.image.avatar(24),
    phoneNumber: '+40 777666555',
    country: 'United States',
    address: '90210 Broadway Blvd',
    state: 'California',
    city: 'San Francisco',
    zipCode: '94116',
    about: 'Praesent turpis. Phasellus viverra nulla ut metus varius laoreet. Phasellus tempus.',
    role: 'admin',
    roles: ['admin'],
    permissions: [],
    isPublic: true,
  };

  return { user };
}
