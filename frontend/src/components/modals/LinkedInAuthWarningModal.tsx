import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface LinkedInAuthWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LinkedInAuthWarningModal: React.FC<
  LinkedInAuthWarningModalProps
> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();

  const handleConnect = () => {
    onOpenChange(false);
    navigate("/settings?tab=connections");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-[#03624C]/50 bg-[#051414]"
        style={{
          backdropFilter: "blur(12px)",
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            LinkedIn Authorization Required
          </DialogTitle>
          <DialogDescription className="text-gray-300 mt-2">
            You need to authorize your LinkedIn account before you can post.
            Click "Connect" to set up your LinkedIn connection in Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Close
          </Button>
          <Button
            onClick={handleConnect}
            className="flex-1 text-white"
            style={{ backgroundColor: "#03624C" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#2CC295")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#03624C")
            }
          >
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
