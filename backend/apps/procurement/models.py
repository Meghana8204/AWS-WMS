from django.db import models
from common.models import BaseModel

class ApprovalRule(BaseModel):
    rule_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    # Rules can be based on PO Type, Total Amount (configured in metadata), etc.
    # For now, let's keep it simple with a priority based chain

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.rule_name

class ApprovalStep(BaseModel):
    rule = models.ForeignKey(ApprovalRule, on_delete=models.CASCADE, related_name="steps")
    step_number = models.IntegerField()
    role = models.ForeignKey("accounts.Role", on_delete=models.CASCADE)

    # Or specific user
    user = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["step_number"]
        unique_together = ("rule", "step_number")

    def __str__(self):
        return f"{self.rule.rule_name} - Step {self.step_number}"
