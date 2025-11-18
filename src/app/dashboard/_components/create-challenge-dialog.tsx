import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

import { ChallengeForm } from './challenge-form';

export function CreateChallengeDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create Challenge</Button>
      </DialogTrigger>
      <DialogContent>
        <ChallengeForm />
      </DialogContent>
    </Dialog>
  );
}
