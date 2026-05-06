export interface DeleteAccountSectionProps {
  userEmail: string;
}

export interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}
