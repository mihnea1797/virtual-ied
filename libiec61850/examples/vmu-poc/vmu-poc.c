/*
 * merging-unit-poc.c
 *
 * Merging unit PoC example for GOOSE publisher and SV subscriber.
 *
 */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <stdio.h>
#include <signal.h>

#include "hal_thread.h"
#include "mms_value.h"
#include "goose_publisher.h"
#include "sv_subscriber.h"

#define THRESHOLD 1413

static bool running = true;

void sigint_handler(int signalId)
{
    running = 0;
}

/* Callback handler for received SV messages */
static void svUpdateListener(SVSubscriber subscriber, void *parameter, SVSubscriber_ASDU asdu)
{
    if (!running)
        return;

    printf("svUpdateListener called\n");

    const char *svID = SVSubscriber_ASDU_getSvId(asdu);

    if (svID != NULL)
        printf("  svID=(%s)\n", svID);

    printf("  smpCnt: %i\n", SVSubscriber_ASDU_getSmpCnt(asdu));
    printf("  confRev: %u\n", SVSubscriber_ASDU_getConfRev(asdu));
    int dataSize = SVSubscriber_ASDU_getDataSize(asdu);
    printf("  dataSize: %i\n", SVSubscriber_ASDU_getDataSize(asdu));

    if (dataSize >= 16)
    {
        int offset = 0;
        int counter = 0;
        while (offset < dataSize)
        {
            int32_t value = SVSubscriber_ASDU_getINT32(asdu, offset);
            offset += 4;
            double current = value / (1000 * 1.41);
            printf("   Current[%d]: %lf\n", counter, current);
            Quality quality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;
            printf("   Quality_Current[%d]: %u\n", counter, quality);

            value = SVSubscriber_ASDU_getINT32(asdu, offset);
            offset += 4;
            double voltage = value / 1.41;
            printf("   Voltage[%d]: %lf\n", counter, voltage);
            quality = SVSubscriber_ASDU_getQuality(asdu, offset);
            offset += 4;
            printf("   Quality_Voltage[%d]: %u\n", counter, quality);
            counter++;

            if (false)
            {
                // Publish a GOOSE message
                GoosePublisher publisher = (GoosePublisher)parameter;
                LinkedList dataSetValues = LinkedList_create();

                // Add values to the GOOSE data set
                LinkedList_add(dataSetValues, MmsValue_newBoolean(true)); // example value
                LinkedList_add(dataSetValues, MmsValue_newBitString(23)); // example quality

                GoosePublisher_increaseStNum(publisher);

                GoosePublisher_publish(publisher, dataSetValues);

                LinkedList_destroyDeep(dataSetValues, (LinkedListValueDeleteFunction)MmsValue_delete);

                printf("GOOSE message published due to threshold breach\n");

                // Stop running after publishing one message
                running = false;

                break;
            }
        }
    }
    else
    {
        printf("   Data size too small to contain FLOAT32 values\n");
    }
}

int main(int argc, char **argv)
{
    char *goose_interface = "eth0";
    char *sv_interface = "eth0";

    printf("Using interface %s for GOOSE\n", goose_interface);

    // GOOSE Publisher setup
    CommParameters gooseCommParameters;
    gooseCommParameters.appId = 0x03;
    gooseCommParameters.dstAddress[0] = 0x01;
    gooseCommParameters.dstAddress[1] = 0x0c;
    gooseCommParameters.dstAddress[2] = 0xcd;
    gooseCommParameters.dstAddress[3] = 0x01;
    gooseCommParameters.dstAddress[4] = 0x00;
    gooseCommParameters.dstAddress[5] = 0x00;
    gooseCommParameters.vlanId = 0;
    gooseCommParameters.vlanPriority = 4;

    GoosePublisher publisher = GoosePublisher_create(&gooseCommParameters, goose_interface);

    if (publisher)
    {
        GoosePublisher_setGoCbRef(publisher, "AA1J4Q15A1LD0/LLN0$GO$RPG");
        GoosePublisher_setConfRev(publisher, 1);
        GoosePublisher_setGoID(publisher, "AA1J4Q15A1LD0/LLN0.RPG");
        GoosePublisher_setDataSetRef(publisher, "AA1J4Q15A1LD0/LLN0$Gss");
        GoosePublisher_setTimeAllowedToLive(publisher, 500);

        // SV Subscriber setup
        SVReceiver receiver = SVReceiver_create();

        SVReceiver_setInterfaceId(receiver, sv_interface);
        printf("Using interface %s for SV\n", sv_interface);

        SVSubscriber subscriber = SVSubscriber_create(NULL, 0x4000);
        SVSubscriber_setListener(subscriber, svUpdateListener, (void *)publisher);
        SVReceiver_addSubscriber(receiver, subscriber);

        SVReceiver_start(receiver);

        if (SVReceiver_isRunning(receiver))
        {
            signal(SIGINT, sigint_handler);

            while (running)
                Thread_sleep(1);

            SVReceiver_stop(receiver);
        }
        else
        {
            printf("Failed to start SV subscriber. Reason can be that the Ethernet interface doesn't exist or root permission are required.\n");
        }

        SVReceiver_destroy(receiver);
        GoosePublisher_destroy(publisher);
    }
    else
    {
        printf("Failed to create GOOSE publisher. Reason can be that the Ethernet interface doesn't exist or root permission are required.\n");
    }

    return 0;
}
