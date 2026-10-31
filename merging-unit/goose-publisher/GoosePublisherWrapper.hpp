extern "C"
{
#include <goose_publisher.h>
#include <r_session.h>
}

#include <sstream>
#include <string>
#include <iomanip>
#include <cstdint>
#include <vector>
#include <map>
#include <mutex>
#include <nlohmann/json.hpp>

struct GooseRSessionKey
{
    int id;
    std::string key;
    std::string secAlgo;
    std::string sigAlgo;
};

// One rGOOSE destination: its own publisher and R-session
struct GooseConnection
{
    GoosePublisher publisher = nullptr;
    RSession       rSession  = nullptr;
};

class GoosePublisherWrapper
{
private:
    std::vector<GooseConnection> _connections;
    bool _lastValue    = false;  // publish on state CHANGE only (stNum semantics);
    bool _havePublished = false; // the per-sample caller would otherwise emit ~16k GOOSE/s
    std::map<uint16_t, bool> _streamAbove; // per-stream threshold state (appId -> above), OR-ed
    std::mutex _lock;                      // PublishMessage runs on every stream's receive thread

    static GooseConnection createConnection(const nlohmann::json &settings);

public:
    // settings is the gooseSettings JSON array
    GoosePublisherWrapper(const nlohmann::json &settings);
    ~GoosePublisherWrapper();

    void PublishMessage(uint16_t appId, bool value); // per-stream state; trip = OR over streams
    void Print();
};
