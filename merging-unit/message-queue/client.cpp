#include <SimpleAmqpClient/SimpleAmqpClient.h>
#include <iostream>
#include <string>
#include <nlohmann/json.hpp>

int main()
{
    std::string hostname = "localhost";
    std::string sendQueue = "cpp_to_node";
    std::string receiveQueue = "node_to_cpp";

    auto connection = AmqpClient::Channel::Create(hostname);

    connection->DeclareQueue(sendQueue, false, true, false, false);
    connection->DeclareQueue(receiveQueue, false, true, false, false);

    // Receive a message from Node.js
    AmqpClient::Envelope::ptr_t envelope = connection->BasicConsumeMessage(receiveQueue);
    std::string received_msg = envelope->Message()->Body();
    std::cout << "Received: " << received_msg << std::endl;

    auto json_msg = nlohmann::json::parse(received_msg);
    json_msg["response"] = "Processed by C++";

    std::string response_msg = json_msg.dump();

    // Send a message to Node.js
    connection->BasicPublish("", sendQueue, AmqpClient::BasicMessage::Create(response_msg));
    std::cout << "Sent: " << response_msg << std::endl;

    return 0;
}
