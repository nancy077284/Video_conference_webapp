import React from 'react';
import { Avatar as MuiAvatar, Box } from '@mui/material';

const palette = ['#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#db2777'];

const hashOf = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) % 100000;
  return h;
};

const UserAvatar = ({ name = '', avatar = '', size = 40, ...rest }) => {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (avatar) {
    return (
      <MuiAvatar
        src={avatar}
        alt={name}
        sx={{ width: size, height: size, bgcolor: palette[hashOf(name) % palette.length] }}
        {...rest}
      />
    );
  }
  return (
    <MuiAvatar
      sx={{
        width: size,
        height: size,
        bgcolor: palette[hashOf(name) % palette.length],
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
      {...rest}
    >
      {initial}
    </MuiAvatar>
  );
};

export const AvatarGroup = ({ users = [], max = 3, size = 30 }) => {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((u, i) => (
        <Box key={u.id || u._id || i} sx={{ ml: i === 0 ? 0 : -0.75, border: 2, borderColor: 'background.paper', borderRadius: '50%' }}>
          <UserAvatar name={u.name} avatar={u.avatar} size={size} />
        </Box>
      ))}
      {extra > 0 && (
        <Box
          sx={{
            ml: -0.75,
            width: size,
            height: size,
            borderRadius: '50%',
            bgcolor: 'neutral.main',
            color: 'common.white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            border: 2,
            borderColor: 'background.paper',
          }}
        >
          +{extra}
        </Box>
      )}
    </Box>
  );
};

export default UserAvatar;
