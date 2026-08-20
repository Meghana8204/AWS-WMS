from django.db import models
from django.contrib.auth.models import AbstractUser, Permission
from common.models import BaseModel

class Role(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, blank=True)

    def __str__(self):
        return self.name

class User(AbstractUser, BaseModel):
    email = models.EmailField(unique=True)
    roles = models.ManyToManyField(Role, blank=True, related_name="users")

    # Audit fields from BaseModel will be used.
    # Note: AbstractUser has its own fields like username, first_name, etc.

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.username

    @property
    def all_permissions(self):
        perms = set(self.user_permissions.all())
        for role in self.roles.all():
            perms.update(role.permissions.all())
        return perms
