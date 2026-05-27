#include <stdio.h>
#include <stdlib.h>

struct Account
{
    int accNo;
    char name[50];
    float balance;
};

void createAccount()
{
    FILE *fp;
    struct Account a;

    fp = fopen("bank.dat", "ab");

    printf("Enter Account Number: ");
    scanf("%d", &a.accNo);

    printf("Enter Name: ");
    scanf(" %[^\n]", a.name);

    printf("Enter Initial Balance: ");
    scanf("%f", &a.balance);

    fwrite(&a, sizeof(a), 1, fp);

    fclose(fp);

    printf("Account Created Successfully.\n");
}

void deposit()
{
    FILE *fp;
    struct Account a;
    int accNo, found = 0;
    float amount;

    fp = fopen("bank.dat", "rb+");

    printf("Enter Account Number: ");
    scanf("%d", &accNo);

    printf("Enter Deposit Amount: ");
    scanf("%f", &amount);

    while(fread(&a, sizeof(a), 1, fp))
    {
        if(a.accNo == accNo)
        {
            a.balance += amount;

            fseek(fp, -sizeof(a), SEEK_CUR);
            fwrite(&a, sizeof(a), 1, fp);

            printf("Deposit Successful.\n");
            found = 1;
            break;
        }
    }

    if(!found)
        printf("Account not found.\n");

    fclose(fp);
}

void withdraw()
{
    FILE *fp;
    struct Account a;
    int accNo, found = 0;
    float amount;

    fp = fopen("bank.dat", "rb+");

    printf("Enter Account Number: ");
    scanf("%d", &accNo);

    printf("Enter Withdraw Amount: ");
    scanf("%f", &amount);

    while(fread(&a, sizeof(a), 1, fp))
    {
        if(a.accNo == accNo)
        {
            if(a.balance >= amount)
            {
                a.balance -= amount;

                fseek(fp, -sizeof(a), SEEK_CUR);
                fwrite(&a, sizeof(a), 1, fp);

                printf("Withdrawal Successful.\n");
            }
            else
            {
                printf("Insufficient Balance.\n");
            }

            found = 1;
            break;
        }
    }

    if(!found)
        printf("Account not found.\n");

    fclose(fp);
}

void balanceEnquiry()
{
    FILE *fp;
    struct Account a;
    int accNo, found = 0;

    fp = fopen("bank.dat", "rb");

    printf("Enter Account Number: ");
    scanf("%d", &accNo);

    while(fread(&a, sizeof(a), 1, fp))
    {
        if(a.accNo == accNo)
        {
            printf("\nAccount Holder: %s", a.name);
            printf("\nBalance: %.2f\n", a.balance);

            found = 1;
            break;
        }
    }

    if(!found)
        printf("Account not found.\n");

    fclose(fp);
}

int main()
{
    int choice;

    while(1)
    {
        printf("\n===== Banking System =====\n");
        printf("1. Create Account\n");
        printf("2. Deposit\n");
        printf("3. Withdraw\n");
        printf("4. Balance Enquiry\n");
        printf("5. Exit\n");

        printf("Enter Choice: ");
        scanf("%d", &choice);

        switch(choice)
        {
            case 1:
                createAccount();
                break;

            case 2:
                deposit();
                break;

            case 3:
                withdraw();
                break;

            case 4:
                balanceEnquiry();
                break;

            case 5:
                exit(0);

            default:
                printf("Invalid Choice.\n");
        }
    }

    return 0;
}