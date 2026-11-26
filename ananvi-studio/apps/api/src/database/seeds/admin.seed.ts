import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@ananvi/shared';
import AppDataSource from '../datasource';
import { Role } from '../../modules/users/entities/role.entity';
import { User } from '../../modules/users/entities/user.entity';

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USERNAME;

  if (!email || !password || !username) {
    console.error('Missing required env vars: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME');
    process.exit(1);
  }

  await AppDataSource.initialize();

  try {
    const roleRepo = AppDataSource.getRepository(Role);
    const userRepo = AppDataSource.getRepository(User);

    // Find or create each Role
    const roleEntities = await Promise.all(
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER].map(async (name) => {
        let role = await roleRepo.findOne({ where: { name } });
        if (!role) {
          role = roleRepo.create({ name });
          await roleRepo.save(role);
          console.log(`Created role: ${name}`);
        }
        return role;
      }),
    );

    // Find or create admin user
    let user = await userRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      const password_hash = await bcrypt.hash(password, 12);
      user = userRepo.create({
        email: email.toLowerCase().trim(),
        username: username.toLowerCase().trim(),
        password_hash,
        is_active: true,
      });
      console.log(`Creating admin user: ${email}`);
    } else {
      console.log(`Updating existing user: ${email}`);
    }

    user.roles = roleEntities;
    await userRepo.save(user);

    console.log('Admin seed completed successfully.');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
