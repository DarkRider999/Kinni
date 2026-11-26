import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. roles
    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'name', type: 'enum', enum: ['super_admin', 'admin', 'manager', 'user'], isUnique: true },
          { name: 'description', type: 'varchar', length: '255', isNullable: true },
        ],
      }),
      true,
    );

    // 2. users
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'email', type: 'varchar', length: '255', isUnique: true },
          { name: 'username', type: 'varchar', length: '50', isUnique: true },
          { name: 'password_hash', type: 'varchar', length: '255' },
          { name: 'display_name', type: 'varchar', length: '100', isNullable: true },
          { name: 'avatar_url', type: 'varchar', length: '512', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'is_email_verified', type: 'boolean', default: false },
          { name: 'totp_secret', type: 'varchar', length: '255', isNullable: true },
          { name: 'totp_enabled', type: 'boolean', default: false },
          { name: 'reset_token', type: 'varchar', length: '255', isNullable: true },
          { name: 'reset_token_expires', type: 'timestamp', isNullable: true },
          { name: 'last_login_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    // 3. user_roles join table
    await queryRunner.createTable(
      new Table({
        name: 'user_roles',
        columns: [
          { name: 'user_id', type: 'uuid', isPrimary: true },
          { name: 'role_id', type: 'uuid', isPrimary: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'user_roles',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_roles',
      new TableForeignKey({
        columnNames: ['role_id'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 4. jobs
    await queryRunner.createTable(
      new Table({
        name: 'jobs',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'user_id', type: 'uuid' },
          { name: 'source_url', type: 'varchar', length: '2048' },
          { name: 'source_platform', type: 'varchar', length: '20', default: "'youtube'" },
          { name: 'source_duration_seconds', type: 'int', default: 0 },
          { name: 'credits_charged', type: 'int', default: 0 },
          { name: 'status', type: 'enum', enum: ['queued', 'processing', 'complete', 'error', 'cancelled'], default: "'queued'" },
          { name: 'clip_count', type: 'int', default: 10 },
          { name: 'caption_style', type: 'enum', enum: ['wavy', 'excited', 'tension', 'neon', 'lowkey', 'animated'], default: "'excited'" },
          { name: 'caption_language', type: 'varchar', length: '10', default: "'en'" },
          { name: 'ai_video_style', type: 'enum', enum: ['found-footage', 'animal-clips', 'security-cam', 'court-comedy', '3d-cartoon'], isNullable: true },
          { name: 'progress_percent', type: 'smallint', default: 0 },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'started_at', type: 'timestamp', isNullable: true },
          { name: 'completed_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'jobs',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex('jobs', new TableIndex({ columnNames: ['user_id'] }));
    await queryRunner.createIndex('jobs', new TableIndex({ columnNames: ['status'] }));
    await queryRunner.createIndex('jobs', new TableIndex({ columnNames: ['created_at'] }));

    // 5. clips
    await queryRunner.createTable(
      new Table({
        name: 'clips',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'job_id', type: 'uuid' },
          { name: 'user_id', type: 'uuid' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'start_time', type: 'float' },
          { name: 'end_time', type: 'float' },
          { name: 'duration', type: 'float' },
          { name: 'hook_score', type: 'float', default: 0 },
          { name: 'flow_score', type: 'float', default: 0 },
          { name: 'value_score', type: 'float', default: 0 },
          { name: 'overall_score', type: 'float', default: 0 },
          { name: 'video_s3_key', type: 'varchar', length: '1024' },
          { name: 'thumbnail_s3_key', type: 'varchar', length: '1024', isNullable: true },
          { name: 'is_favorite', type: 'boolean', default: false },
          { name: 'export_count', type: 'int', default: 0 },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'clips',
      new TableForeignKey({
        columnNames: ['job_id'],
        referencedTableName: 'jobs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex('clips', new TableIndex({ columnNames: ['job_id'] }));
    await queryRunner.createIndex('clips', new TableIndex({ columnNames: ['user_id'] }));
    await queryRunner.createIndex('clips', new TableIndex({ columnNames: ['overall_score'] }));

    // 6. captions
    await queryRunner.createTable(
      new Table({
        name: 'captions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'clip_id', type: 'uuid' },
          { name: 'language', type: 'varchar', length: '10' },
          { name: 'style', type: 'enum', enum: ['wavy', 'excited', 'tension', 'neon', 'lowkey', 'animated'] },
          { name: 'srt_content', type: 'text' },
          { name: 'vtt_content', type: 'text' },
          { name: 'word_timestamps', type: 'jsonb', default: "'[]'" },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'captions',
      new TableForeignKey({
        columnNames: ['clip_id'],
        referencedTableName: 'clips',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex('captions', new TableIndex({ columnNames: ['clip_id'] }));

    // 7. credits (one per user)
    await queryRunner.createTable(
      new Table({
        name: 'credits',
        columns: [
          { name: 'user_id', type: 'uuid', isPrimary: true },
          { name: 'balance', type: 'int', default: 0 },
          { name: 'lifetime_purchased', type: 'int', default: 0 },
          { name: 'lifetime_used', type: 'int', default: 0 },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'credits',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 8. payments
    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'user_id', type: 'uuid' },
          { name: 'dodo_payment_id', type: 'varchar', length: '255', isUnique: true },
          { name: 'amount_cents', type: 'int' },
          { name: 'currency', type: 'varchar', length: '3', default: "'USD'" },
          { name: 'credits_granted', type: 'int' },
          { name: 'status', type: 'enum', enum: ['pending', 'completed', 'failed', 'refunded'], default: "'pending'" },
          { name: 'metadata', type: 'jsonb', default: "'{}'" },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'payments',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex('payments', new TableIndex({ columnNames: ['user_id'] }));
    await queryRunner.createIndex('payments', new TableIndex({ columnNames: ['status'] }));

    // 9. credit_transactions
    await queryRunner.createTable(
      new Table({
        name: 'credit_transactions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'user_id', type: 'uuid' },
          { name: 'type', type: 'enum', enum: ['purchase', 'usage', 'refund', 'bonus', 'admin_adjustment'] },
          { name: 'amount', type: 'int' },
          { name: 'balance_after', type: 'int' },
          { name: 'description', type: 'varchar', length: '500' },
          { name: 'reference_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'credit_transactions',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex('credit_transactions', new TableIndex({ columnNames: ['user_id'] }));
    await queryRunner.createIndex('credit_transactions', new TableIndex({ columnNames: ['created_at'] }));

    // 10. settings
    await queryRunner.createTable(
      new Table({
        name: 'settings',
        columns: [
          { name: 'key', type: 'varchar', length: '100', isPrimary: true },
          { name: 'value', type: 'text' },
          { name: 'description', type: 'varchar', length: '255', isNullable: true },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    // 11. audit_logs
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'user_id', type: 'uuid' },
          { name: 'action', type: 'varchar', length: '100' },
          { name: 'resource_type', type: 'varchar', length: '50' },
          { name: 'resource_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'ip_address', type: 'varchar', length: '45' },
          { name: 'user_agent', type: 'varchar', length: '512', default: "''" },
          { name: 'details', type: 'jsonb', default: "'{}'" },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex('audit_logs', new TableIndex({ columnNames: ['user_id'] }));
    await queryRunner.createIndex('audit_logs', new TableIndex({ columnNames: ['created_at'] }));
    await queryRunner.createIndex('audit_logs', new TableIndex({ columnNames: ['action'] }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_logs', true);
    await queryRunner.dropTable('settings', true);
    await queryRunner.dropTable('credit_transactions', true);
    await queryRunner.dropTable('payments', true);
    await queryRunner.dropTable('credits', true);
    await queryRunner.dropTable('captions', true);
    await queryRunner.dropTable('clips', true);
    await queryRunner.dropTable('jobs', true);
    await queryRunner.dropTable('user_roles', true);
    await queryRunner.dropTable('users', true);
    await queryRunner.dropTable('roles', true);
  }
}
