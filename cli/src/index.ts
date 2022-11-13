import { program } from 'commander';

import './init';
import './whitelist';
import './toggle_lock';
import './verify_manifest';
import './update';

program.parse(process.argv);
